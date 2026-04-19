import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import User from "../models/User.model.js";





// ----------------------------
// Worker
// ----------------------------
const worker = new Worker(
  "favorite-queue",
  async (job) => {
    const { postId, userId, action } = job.data;

    if (!postId || !userId) {
      throw new Error("Missing parameters: postId or userId");
    }

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

      // 2. Increment Post's favoritesCount
      if (userUpdate) {
         await Post.findByIdAndUpdate(postId, { $inc: { favoritesCount: 1 } });
         console.log(`User ${userId} favorited post ${postId}`);
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

      // 2. Decrement Post's favoritesCount
      if (userUpdate) {
        await Post.findOneAndUpdate(
             { _id: postId, favoritesCount: { $gt: 0 } }, 
             { $inc: { favoritesCount: -1 } }
        );
        console.log(`User ${userId} unfavorited post ${postId}`);
      }
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 20 } 
);

console.log("🚀 Favorite Worker Running...");
