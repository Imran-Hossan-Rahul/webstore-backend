import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import User from "../models/User.model.js";
import Codex from "../models/Codex.model.js";
import Artifact from "../models/Artifact.model.js";
import Job from "../models/Job.model.js";
import Challenge from "../models/Challenge.model.js";

const models = { 
  Post: Post, 
  Codex: Codex, 
  Artifact: Artifact,
  Job: Job,
  Challenge: Challenge
};

/**
 * Favorite Craftsman
 * Handles polymorphic favorite toggle operations.
 */
const craftsman = new Craftsman(
  "favorite-queue",
  async (job) => {
    const { postId, userId, action, itemType = 'Post' } = job.data;

    if (!postId || !userId) {
      throw new Error("Missing parameters: postId or userId");
    }

    const Model = models[itemType] || Post;

    // ----------------------------
    // ADD FAVORITE
    // ----------------------------
    if (action === "add") {
      // 1. Add to User's favorites
      const userUpdate = await User.findOneAndUpdate(
        { _id: userId },
        { $addToSet: { favorites: postId } },
        { new: true }
      );

      // 2. Increment target item's favoritesCount
      if (userUpdate) {
         await Model.findByIdAndUpdate(postId, { $inc: { favoritesCount: 1 } });
         console.log(`User ${userId} favorited ${itemType} ${postId}`);
      }
    }

    // ----------------------------
    // REMOVE FAVORITE
    // ----------------------------
    if (action === "remove") {
      // 1. Remove from User's favorites
      const userUpdate = await User.findOneAndUpdate(
        { _id: userId },
        { $pull: { favorites: postId } },
        { new: true }
      );

      // 2. Decrement target item's favoritesCount
      if (userUpdate) {
        await Model.findOneAndUpdate(
             { _id: postId, favoritesCount: { $gt: 0 } }, 
             { $inc: { favoritesCount: -1 } }
        );
        console.log(`User ${userId} unfavorited ${itemType} ${postId}`);
      }
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 20 } 
);

console.log("ðŸš€ Favorite Craftsman Running...");


craftsman.on('error', () => {});
