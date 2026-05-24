import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import Artifact from "../models/Artifact.model.js";
import Codex from "../models/Codex.model.js";
import Post from "../models/Post.model.js";
import { rankingQueue } from "../queues/index.js";

// -----------------------------
// Environment variables
// -----------------------------
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.FLUSH_INTERVAL_MS || "5000", 10);

console.log("ðŸŸ¢ Using Redis host:", REDIS_HOST);
console.log("ðŸŸ¢ Using Redis port:", REDIS_PORT);

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
    console.error("âŒ Redis GET+DEL error:", key, err.message);
    return null;
  }
}

// -----------------------------
// Flush Logic
// -----------------------------
const SCAN_COUNT = 200;

async function flushImpressionsOnce() {
  console.log("ðŸ§¹ Starting impression flush cycle...");
  const deltas = new Map();
  const codexDeltas = new Map();
  const postDeltas = new Map();

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

  // 1. Artifact impressions delta
  for await (const key of scanKeys("impressions:delta:*")) {
    const artifactId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = deltas.get(artifactId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    deltas.set(artifactId, cur);

    console.log(`ðŸ”¹ Artifact impressions delta collected: ${artifactId} += ${val}`);
  }

  // 2. Codex impressions delta
  for await (const key of scanKeys("impressions:codex:*")) {
    const codexId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = codexDeltas.get(codexId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    codexDeltas.set(codexId, cur);

    console.log(`ðŸ”¹ Codex impressions delta collected: ${codexId} += ${val}`);
  }

  // 3. Post impressions delta
  for await (const key of scanKeys("impressions:post:*")) {
    const postId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = postDeltas.get(postId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    postDeltas.set(postId, cur);

    console.log(`ðŸ”¹ Post impressions delta collected: ${postId} += ${val}`);
  }

  if (deltas.size === 0 && codexDeltas.size === 0 && postDeltas.size === 0) {
    console.log("â„¹ï¸ No impression deltas to flush.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // 1. Process Artifacts
  const bulkOps = [];
  if (deltas.size > 0) {
    const artifactIds = Array.from(deltas.keys());
    const artifacts = await Artifact.find({ _id: { $in: artifactIds } }).select('_id impressionHistory');
    const artifactMap = new Map(artifacts.map(t => [t._id.toString(), t]));

    for (const [artifactId, { impressions }] of deltas.entries()) {
      const artifact = artifactMap.get(artifactId);
      if (!artifact) continue;

      const existingEntry = artifact.impressionHistory?.find(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === today.getTime();
      });

      if (existingEntry) {
        bulkOps.push({
          updateOne: {
            filter: { _id: artifactId, 'impressionHistory.date': { $gte: today, $lt: tomorrow } },
            update: { $inc: { impressionsCount: impressions, 'impressionHistory.$.count': impressions } },
          },
        });
      } else {
        bulkOps.push({
          updateOne: {
            filter: { _id: artifactId },
            update: {
              $inc: { impressionsCount: impressions },
              $push: { impressionHistory: { date: today, count: impressions } }
            },
          },
        });
      }
    }
  }

  // 2. Process Codex
  const codexBulkOps = [];
  if (codexDeltas.size > 0) {
    const codexIds = Array.from(codexDeltas.keys());
    const codex = await Codex.find({ _id: { $in: codexIds } }).select('_id impressionHistory');
    const codexMap = new Map(codex.map(b => [b._id.toString(), b]));

    for (const [codexId, { impressions }] of codexDeltas.entries()) {
      const codex = codexMap.get(codexId);
      if (!codex) continue;

      const existingEntry = codex.impressionHistory?.find(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === today.getTime();
      });

      if (existingEntry) {
        codexBulkOps.push({
          updateOne: {
            filter: { _id: codexId, 'impressionHistory.date': { $gte: today, $lt: tomorrow } },
            update: { $inc: { impressions: impressions, 'impressionHistory.$.count': impressions } },
          },
        });
      } else {
        codexBulkOps.push({
          updateOne: {
            filter: { _id: codexId },
            update: {
              $inc: { impressions: impressions },
              $push: { impressionHistory: { date: today, count: impressions } }
            },
          },
        });
      }
    }
  }

  // 3. Process Posts
  const postBulkOps = [];
  if (postDeltas.size > 0) {
    const postIds = Array.from(postDeltas.keys());
    const posts = await Post.find({ _id: { $in: postIds } }).select('_id impressionHistory');
    const postMap = new Map(posts.map(p => [p._id.toString(), p]));

    for (const [postId, { impressions }] of postDeltas.entries()) {
      const post = postMap.get(postId);
      if (!post) continue;

      const existingEntry = post.impressionHistory?.find(entry => {
        const d = new Date(entry.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });

      if (existingEntry) {
        postBulkOps.push({
          updateOne: {
            filter: { _id: postId, "impressionHistory.date": { $gte: today, $lt: tomorrow } },
            update: { $inc: { impressions: impressions, "impressionHistory.$.count": impressions } }
          }
        });
      } else {
        postBulkOps.push({
          updateOne: {
            filter: { _id: postId },
            update: {
              $inc: { impressions: impressions },
              $push: { impressionHistory: { date: today, count: impressions } }
            }
          }
        });
      }
    }
  }

  try {
    if (bulkOps.length > 0) {
      console.log(`ðŸ’¾ Bulk writing ${bulkOps.length} artifacts impressions...`);
      await Artifact.bulkWrite(bulkOps, { ordered: false });
    }

    if (codexBulkOps.length > 0) {
      console.log(`ðŸ’¾ Bulk writing ${codexBulkOps.length} codex impressions...`);
      await Codex.bulkWrite(codexBulkOps, { ordered: false });
    }

    if (postBulkOps.length > 0) {
      console.log(`ðŸ’¾ Bulk writing ${postBulkOps.length} posts impressions...`);
      await Post.bulkWrite(postBulkOps, { ordered: false });
    }

    // Optional: enqueue ranking updates
    for (const id of deltas.keys()) {
      await rankingQueue.add(
        "update-impression-scores",
        { artifactId: id },
        { removeOnComplete: true, removeOnFail: true }
      );
      console.log(`ðŸš€ Ranking job queued for artifact: ${id}`);
    }

    console.log("âœ… Impression flush cycle completed successfully.");
  } catch (err) {
    console.error("âŒ Flush bulkWrite error:", err);

    // Rollback to Redis
    for (const [artifactId, { impressions }] of deltas.entries()) {
      await redis.incrby(`impressions:delta:${artifactId}`, impressions);
    }
    for (const [codexId, { impressions }] of codexDeltas.entries()) {
      await redis.incrby(`impressions:codex:${codexId}`, impressions);
    }
    for (const [postId, { impressions }] of postDeltas.entries()) {
      await redis.incrby(`impressions:post:${postId}`, impressions);
    }
  }
}

// -----------------------------
// Craftsman loop
// -----------------------------
function runFlushImpressionCraftsman() {
  console.log("ðŸš€ Flush Impression Craftsman Started");
  setInterval(() => {
    flushImpressionsOnce().catch((err) =>
      console.error("âŒ Flush error:", err)
    );
  }, FLUSH_INTERVAL_MS);
}

runFlushImpressionCraftsman();


