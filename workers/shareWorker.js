import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import Blog from "../models/blog.model.js";
import ButtonTemplate from "../models/Template.model.js";




// ----------------------------
// Queue Events
// ----------------------------

// ----------------------------
// Worker Logic
// ----------------------------
const worker = new Worker(
  "share-queue",
  async (job) => {
    const { itemId, type, userId, platform } = job.data;

    if (!itemId) {
      throw new Error("Missing itemId");
    }

    const shareData = {
        userId: userId || null,
        platform: platform || 'unknown',
        timestamp: new Date()
    };

    try {
        if (type === 'post') {
            await Post.findByIdAndUpdate(itemId, {
                $inc: { sharesCount: 1 },
                $push: { shareHistory: shareData }
            });
            console.log(`✅ Post Shared: ${itemId}`);
        } else if (type === 'blog') {
            await Blog.findByIdAndUpdate(itemId, {
                $inc: { sharesCount: 1 },
                $push: { shareHistory: shareData }
            });
            console.log(`✅ Blog Shared: ${itemId}`);
        } else if (type === 'template') {
            // Check if model has shareHistory (added in previous session)
            await ButtonTemplate.findByIdAndUpdate(itemId, {
                $inc: { sharesCount: 1 },
                $push: { shareHistory: shareData }
            });
            console.log(`✅ Template Shared: ${itemId}`);
        } else {
            console.warn(`⚠️ Unknown type for share job: ${type}`);
        }
    } catch (err) {
        console.error(`❌ Share processing failed for ${type} ${itemId}:`, err);
        throw err;
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 50 }
);

console.log("🚀 Share Worker Running...");
