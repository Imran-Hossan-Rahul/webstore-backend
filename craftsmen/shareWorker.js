import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import Codex from "../models/Codex.model.js";
import Artifact from "../models/Artifact.model.js";




// ----------------------------
// Queue Events
// ----------------------------

// ----------------------------
// Craftsman Logic
// ----------------------------
const craftsman = new Craftsman(
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
            console.log(`âœ… Post Shared: ${itemId}`);
        } else if (type === 'codex') {
            await Codex.findByIdAndUpdate(itemId, {
                $inc: { sharesCount: 1 },
                $push: { shareHistory: shareData }
            });
            console.log(`âœ… Codex Shared: ${itemId}`);
        } else if (type === 'artifact') {
            // Check if model has shareHistory (added in previous session)
            await Artifact.findByIdAndUpdate(itemId, {
                $inc: { sharesCount: 1 },
                $push: { shareHistory: shareData }
            });
            console.log(`âœ… Artifact Shared: ${itemId}`);
        } else {
            console.warn(`âš ï¸ Unknown type for share job: ${type}`);
        }
    } catch (err) {
        console.error(`âŒ Share processing failed for ${type} ${itemId}:`, err);
        throw err;
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 50 }
);

console.log("ðŸš€ Share Craftsman Running...");


