// backend/workers/flushWorkerFull.js

import "dotenv/config"; // load .env
import mongoose from "mongoose";
import redis from "../config/redis.js";
import ButtonTemplate from "../models/Template.model.js";
import { rankingQueue } from "../queues/index.js";

// -----------------------------
// Environment variables
// -----------------------------
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.FLUSH_INTERVAL_MS || "5000", 10);

console.log("🟢 Using Redis host:", REDIS_HOST);
console.log("🟢 Using Redis port:", REDIS_PORT);

// -----------------------------
// MongoDB Connection
// -----------------------------



// -----------------------------
// Helper: GET+DEL atomically
// -----------------------------
const GETDEL_LUA = `
  local v = redis.call('GET', KEYS[1]);
  if v then
    redis.call('DEL', KEYS[1]);
    return v;
  end
  return nil;
`;

async function getAndDel(key) {
  try {
    const res = await redis.eval(GETDEL_LUA, 1, key);
    return res ? res : null;
  } catch (err) {
    console.error("❌ Redis GET+DEL error:", key, err.message);
    return null;
  }
}

// -----------------------------
// Flush Logic
// -----------------------------
const SCAN_COUNT = 200;

async function flushOnce() {
  console.log("🧹 Starting flush cycle...");
  const deltas = new Map();

  async function* scanKeys(pattern) {
    let cursor = "0";
    do {
      const res = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT
      );
      cursor = res[0];
      const keys = res[1];
      for (const k of keys) yield k;
    } while (cursor !== "0");
  }

  // -----------------------------
  // Collect views delta
  // -----------------------------
  for await (const key of scanKeys("views:delta:*")) {
    const templateId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;
    const cur = deltas.get(templateId) || { views: 0, downloads: 0 };
    cur.views += parseInt(val, 10);
    deltas.set(templateId, cur);
    console.log(`🔹 Views delta collected: ${templateId} += ${val}`);
  }

  // -----------------------------
  // Collect downloads delta
  // -----------------------------
  for await (const key of scanKeys("downloads:delta:*")) {
    const templateId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;
    const cur = deltas.get(templateId) || { views: 0, downloads: 0 };
    cur.downloads += parseInt(val, 10);
    deltas.set(templateId, cur);
    console.log(`🔹 Downloads delta collected: ${templateId} += ${val}`);
  }

  if (deltas.size === 0) {
    console.log("ℹ️ No deltas to flush.");
    return;
  }

  // -----------------------------
  // Bulk write to MongoDB
  // -----------------------------
  const bulkOps = [];
  for (const [templateId, { views, downloads }] of deltas.entries()) {
    const incObj = {};
    if (views) incObj.viewsCount = views;
    if (downloads) incObj.downloadsCount = downloads;

    bulkOps.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(templateId) },
        update: { $inc: incObj },
      },
    });
    console.log(`💾 Prepared bulk update for template ${templateId}:`, incObj);
  }

  try {
    console.log(`💾 Bulk writing ${bulkOps.length} templates...`);
    await ButtonTemplate.bulkWrite(bulkOps, { ordered: false });

    // -----------------------------
    // Enqueue ranking updates
    // -----------------------------
    for (const id of deltas.keys()) {
      await rankingQueue.add(
        "update-scores",
        { templateId: id },
        { removeOnComplete: true, removeOnFail: true }
      );
      console.log(`🚀 Ranking job queued for template: ${id}`);
    }

    console.log("✅ Flush cycle completed successfully.");
  } catch (err) {
    console.error("❌ Flush bulkWrite error:", err);

    // -----------------------------
    // Rollback to Redis
    // -----------------------------
    for (const [templateId, { views, downloads }] of deltas.entries()) {
      if (views) await redis.incrby(`views:delta:${templateId}`, views);
      if (downloads)
        await redis.incrby(`downloads:delta:${templateId}`, downloads);
      console.log(`🔄 Rolled back deltas to Redis: ${templateId}`);
    }
  }
}

// -----------------------------
// Worker loop
// -----------------------------
function runFlushWorker() {
  console.log("🚀 Flush Worker Started (Full Logging)");
  setInterval(() => {
    flushOnce().catch((err) => console.error("❌ Flush error:", err));
  }, FLUSH_INTERVAL_MS);
}

runFlushWorker();
