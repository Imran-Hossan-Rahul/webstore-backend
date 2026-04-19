import "dotenv/config";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import ButtonTemplate from "../models/Template.model.js";
import Blog from "../models/blog.model.js";
import Post from "../models/Post.model.js";
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

async function flushImpressionsOnce() {
  console.log("🧹 Starting impression flush cycle...");
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

  // Template impressions delta
  for await (const key of scanKeys("impressions:delta:*")) {
    const templateId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = deltas.get(templateId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    deltas.set(templateId, cur);

    console.log(`🔹 Template impressions delta collected: ${templateId} += ${val}`);
  }

  // Blog impressions delta
  const blogDeltas = new Map();
  for await (const key of scanKeys("impressions:blog:*")) {
    const blogId = key.split(":")[2];
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = blogDeltas.get(blogId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    blogDeltas.set(blogId, cur);

    console.log(`🔹 Blog impressions delta collected: ${blogId} += ${val}`);
  }

  if (deltas.size === 0 && blogDeltas.size === 0) {
    console.log("ℹ️ No impression deltas to flush.");
    return;
  }

  // Bulk write templates to MongoDB
  const bulkOps = [];
  for (const [templateId, { impressions }] of deltas.entries()) {
    bulkOps.push({
      updateOne: {
        filter: { _id: templateId },
        update: { $inc: { impressionsCount: impressions } },
      },
    });
  }

  // Bulk write blogs to MongoDB
  const blogBulkOps = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24*60*60*1000);

  for (const [blogId, { impressions }] of blogDeltas.entries()) {
    const blog = await Blog.findById(blogId);
    if (!blog) continue;

    const existingEntry = blog.impressionHistory?.find(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    if (existingEntry) {
      blogBulkOps.push({
        updateOne: {
          filter: { _id: blogId, 'impressionHistory.date': { $gte: today, $lt: tomorrow } },
          update: { $inc: { impressions, 'impressionHistory.$.count': impressions } },
        },
      });
    } else {
      blogBulkOps.push({
        updateOne: {
          filter: { _id: blogId },
          update: { 
            $inc: { impressions },
            $push: { impressionHistory: { date: today, count: impressions } }
          },
        },
      });
    }
  }

  // Post impressions delta
  const postDeltas = new Map();
  for await (const key of scanKeys("impressions:delta:post:*")) {
    const postId = key.split(":")[3]; // impressions:delta:post:ID
    const val = await getAndDel(key);
    if (!val) continue;

    const cur = postDeltas.get(postId) || { impressions: 0 };
    cur.impressions += parseInt(val, 10);
    postDeltas.set(postId, cur);

    console.log(`🔹 Post impressions delta collected: ${postId} += ${val}`);
  }

  // Bulk write posts to MongoDB
  const postBulkOps = [];
  for (const [postId, { impressions }] of postDeltas.entries()) {
     // For posts, we need to check if history exists. Since it's bulk write, checking one by one is slow.
     // But bulkWrite doesn't support "check array element exist, then update, else push" atomically in one generic op comfortably
     // without complex arrayFilters which requires knowing if it exists.
     // Optimization: Just $inc global impressions, and try to $inc today's history.
     // Actually, we can fetch all Posts involved.
     
     const post = await Post.findById(postId);
     if (!post) continue; // Skip deletion or handle error?

     const existingEntry = post.impressionHistory?.find(entry => {
         const d = new Date(entry.date);
         d.setHours(0,0,0,0);
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

  try {
    if (bulkOps.length > 0) {
      console.log(`💾 Bulk writing ${bulkOps.length} templates impressions...`);
      await ButtonTemplate.bulkWrite(bulkOps, { ordered: false });
    }

    if (blogBulkOps.length > 0) {
      console.log(`💾 Bulk writing ${blogBulkOps.length} blogs impressions...`);
      await Blog.bulkWrite(blogBulkOps, { ordered: false });
    }

    if (postBulkOps.length > 0) {
      console.log(`💾 Bulk writing ${postBulkOps.length} posts impressions...`);
      await Post.bulkWrite(postBulkOps, { ordered: false });
    }

    // Optional: enqueue ranking updates
    for (const id of deltas.keys()) {
      await rankingQueue.add(
        "update-impression-scores",
        { templateId: id },
        { removeOnComplete: true, removeOnFail: true }
      );
      console.log(`🚀 Ranking job queued for template: ${id}`);
    }

    console.log("✅ Impression flush cycle completed successfully.");
  } catch (err) {
    console.error("❌ Flush bulkWrite error:", err);

    // Rollback templates to Redis
    for (const [templateId, { impressions }] of deltas.entries()) {
      await redis.incrby(`impressions:delta:${templateId}`, impressions);
      console.log(`🔄 Rolled back template impressions delta to Redis: ${templateId}`);
    }

    // Rollback blogs to Redis
    for (const [blogId, { impressions }] of blogDeltas.entries()) {
      await redis.incrby(`impressions:blog:${blogId}`, impressions);
      console.log(`🔄 Rolled back blog impressions delta to Redis: ${blogId}`);
    }
  }
}

// -----------------------------
// Worker loop
// -----------------------------
function runFlushImpressionWorker() {
  console.log("🚀 Flush Impression Worker Started");
  setInterval(() => {
    flushImpressionsOnce().catch((err) =>
      console.error("❌ Flush error:", err)
    );
  }, FLUSH_INTERVAL_MS);
}

runFlushImpressionWorker();
