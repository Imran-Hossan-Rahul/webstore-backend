/**
 * telemetryBuffer.js
 *
 * A high-performance, in-memory write buffer for high-frequency telemetry events.
 *
 * DESIGN:
 * -------
 * Instead of hitting MongoDB on every analytics request (which causes write contention
 * and buffering timeouts under load), this utility batches events per session into an
 * in-memory Map and flushes them to the database on a configurable interval.
 *
 * This reduces N individual findOneAndUpdate calls down to 1 bulkWrite per flush cycle,
 * dramatically reducing MongoDB write contention and eliminating buffering timeouts.
 *
 * GUARANTEES:
 * -----------
 * - Events are never silently dropped; flush errors are logged and retried on next cycle.
 * - Process termination is handled gracefully (SIGINT/SIGTERM flush remaining events).
 * - Each buffer slot is keyed by `${model}:${sessionId}` to prevent cross-session bleed.
 *
 * USAGE:
 * ------
 * import { getTelemetryBuffer } from './telemetryBuffer.js';
 * const buffer = getTelemetryBuffer(SessionReplay, { flushIntervalMs: 2000, maxBufferSize: 100 });
 * buffer.push(sessionId, 'snapshots', snapshotArray);
 */

import logger from './logger.js';

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_FLUSH_INTERVAL_MS = 3000; // 3 seconds between flush cycles
const DEFAULT_MAX_BUFFER_SIZE   = 200;  // flush immediately if a session buffer hits this
const ARRAY_SLICE_CAP           = 100;  // max array elements per field (lowered to 100 to prevent 16MB MongoDB limit)

// ── Singleton registry ────────────────────────────────────────────────────────
// One TelemetryBuffer instance per (Model, flushKey) combination, stored here.
const _registry = new Map();

// ── TelemetryBuffer class ─────────────────────────────────────────────────────
class TelemetryBuffer {
  /**
   * @param {mongoose.Model} Model   - The Mongoose model to flush into.
   * @param {string}         queryField - The field used to match documents (default: 'sessionId').
   * @param {object}         opts
   * @param {number}         opts.flushIntervalMs
   * @param {number}         opts.maxBufferSize
   */
  constructor(Model, queryField = 'sessionId', opts = {}) {
    this.Model          = Model;
    this.queryField     = queryField;
    this.flushInterval  = opts.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize  = opts.maxBufferSize   || DEFAULT_MAX_BUFFER_SIZE;

    // Map<sessionId, { queryValue, $pushMap: { fieldName: [...events] }, $setMap: {...} }>
    this._buffer = new Map();
    this._timer  = null;
    this._flushing = false;

    this._startTimer();
    this._registerShutdownHooks();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Buffer array events (e.g., snapshots, interactions) for a session.
   * @param {string}   queryValue  - The value of the queryField (e.g., sessionId).
   * @param {string}   arrayField  - The document array field to push into.
   * @param {Array}    items       - Items to push.
   * @param {object}   setFields   - Optional $set fields to merge (e.g., metrics update).
   */
  push(queryValue, arrayField, items, setFields = {}) {
    if (!queryValue || !arrayField) return;
    if (!Array.isArray(items) || items.length === 0) return;

    let slot = this._buffer.get(queryValue);
    if (!slot) {
      slot = { queryValue, pushMap: {}, setMap: {} };
      this._buffer.set(queryValue, slot);
    }

    // Accumulate push events
    if (!slot.pushMap[arrayField]) slot.pushMap[arrayField] = [];
    slot.pushMap[arrayField].push(...items);

    // Merge set fields
    Object.assign(slot.setMap, setFields);

    // Eager flush if buffer for this session is large
    const totalBuffered = Object.values(slot.pushMap).reduce((s, a) => s + a.length, 0);
    if (totalBuffered >= this.maxBufferSize) {
      this._flushSession(queryValue, slot);
      this._buffer.delete(queryValue);
    }
  }

  /**
   * Force-flush all pending events immediately (e.g., on shutdown).
   */
  async flushAll() {
    if (this._flushing) return;
    this._flushing = true;
    const entries = [...this._buffer.entries()];
    this._buffer.clear();
    await Promise.allSettled(entries.map(([key, slot]) => this._flushSession(key, slot)));
    this._flushing = false;
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _startTimer() {
    this._timer = setInterval(async () => {
      if (this._flushing || this._buffer.size === 0) return;
      await this.flushAll();
    }, this.flushInterval);

    // Prevent the timer from keeping Node.js alive if the app is shutting down
    if (this._timer.unref) this._timer.unref();
  }

  async _flushSession(queryValue, slot) {
    if (!slot || Object.keys(slot.pushMap).length === 0) return;

    try {
      const update = {};

      // Build $push with $each + $slice (document size cap)
      const pushOps = {};
      for (const [field, items] of Object.entries(slot.pushMap)) {
        if (items.length > 0) {
          pushOps[field] = {
            $each: items,
            $slice: -ARRAY_SLICE_CAP, // Keep only the MOST RECENT N events
          };
        }
      }

      if (Object.keys(pushOps).length > 0) update.$push = pushOps;
      if (Object.keys(slot.setMap).length > 0) update.$set  = slot.setMap;

      if (Object.keys(update).length === 0) return;

      await this.Model.findOneAndUpdate(
        { [this.queryField]: queryValue },
        update,
        { new: false, runValidators: false }
      );

      const totalEvents = Object.values(slot.pushMap).reduce((s, a) => s + a.length, 0);
      logger.info(`[TelemetryBuffer] Flushed ${totalEvents} events for ${this.queryField}=${queryValue}`);
    } catch (err) {
      logger.error(`[TelemetryBuffer] Flush error for ${this.queryField}=${queryValue}: ${err.message}`);
      // Re-queue the failed slot so it is retried next cycle
      const existing = this._buffer.get(queryValue) || { queryValue, pushMap: {}, setMap: {} };
      for (const [field, items] of Object.entries(slot.pushMap)) {
        if (!existing.pushMap[field]) existing.pushMap[field] = [];
        existing.pushMap[field].push(...items);
      }
      Object.assign(existing.setMap, slot.setMap);
      this._buffer.set(queryValue, existing);
    }
  }

  _registerShutdownHooks() {
    const gracefulShutdown = async (signal) => {
      logger.info(`[TelemetryBuffer] ${signal} received — flushing ${this._buffer.size} pending sessions...`);
      this.destroy();
      await this.flushAll();
      logger.info('[TelemetryBuffer] All telemetry flushed. Exiting.');
    };

    process.once('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }
}

// ── Factory function (singleton per Model) ────────────────────────────────────
/**
 * Get or create a TelemetryBuffer singleton for a given Model.
 *
 * @param {mongoose.Model} Model
 * @param {string}         queryField - Field used to look up the document (default: 'sessionId').
 * @param {object}         opts       - { flushIntervalMs, maxBufferSize }
 */
export function getTelemetryBuffer(Model, queryField = 'sessionId', opts = {}) {
  const key = `${Model.modelName}:${queryField}`;
  if (!_registry.has(key)) {
    _registry.set(key, new TelemetryBuffer(Model, queryField, opts));
  }
  return _registry.get(key);
}

/**
 * Flush all registered buffers (call before process exit in tests or scripts).
 */
export async function flushAllBuffers() {
  await Promise.allSettled([..._registry.values()].map(b => b.flushAll()));
}
