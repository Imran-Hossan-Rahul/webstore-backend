import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import Codex from "../models/codex.model.js";
import Artifact from "../models/Artifact.model.js";





// ----------------------------
// Craftsman
// ----------------------------
const craftsman = new Craftsman(
  "post-like-queue",
  async (job) => {
    const { postId, userId, action, itemType = "post" } = job.data;

    if (!postId || !userId) {
      throw new Error("Missing parameters: postId or userId");
    }

    const Model = itemType === "codex" ? Codex : itemType === "artifact" ? Artifact : Post;
    const countField = itemType === "codex" ? "likesCount" : itemType === "artifact" ? "likeCount" : "likes";
    const arrayField = itemType === "codex" ? "likes" : "likedBy";

    // ----------------------------
    // LIKE
    // ----------------------------
    if (action === "like") {
      const updated = await Model.findOneAndUpdate(
        {
          _id: postId,
          [arrayField]: { $ne: userId }, // Ensure not already liked
        },
        {
          $addToSet: { [arrayField]: userId },
          $inc: { [countField]: 1 },
        },
        { new: true }
      );

      if (!updated) {
        console.log(`User ${userId} already liked ${itemType} ${postId}`);
      } else {
        console.log(`${itemType} ${postId} liked by user ${userId}`);
        
        // Award XP to the AUTHOR (Atomic)
        const authorId = updated.user || updated.author || updated.userId;
        if (authorId && authorId.toString() !== userId.toString()) {
           const GamificationService = (await import("../services/GamificationService.js")).default;
           await GamificationService.awardXP(authorId.toString(), 'GET_LIKE');
        }
      }
    }

    // ----------------------------
    // UNLIKE
    // ----------------------------
    if (action === "unlike") {
      const updated = await Model.findOneAndUpdate(
        {
          _id: postId,
          [arrayField]: userId, // Ensure already liked
        },
        {
          $pull: { [arrayField]: userId },
          $inc: { [countField]: -1 },
        },
        { new: true }
      );

      // Prevent negative likes
      await Model.updateOne({ _id: postId, [countField]: { $lt: 0 } }, { $set: { [countField]: 0 } });

      if (updated) {
        console.log(`${itemType} ${postId} unliked by user ${userId}`);
      }
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 50 } // High concurrency for likes
);

console.log("🚀 Post Like Craftsman Running...");


