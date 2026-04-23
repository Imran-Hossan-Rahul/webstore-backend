import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Post from "../models/Post.model.js";
import Blog from "../models/blog.model.js";
import ButtonTemplate from "../models/Template.model.js";





// ----------------------------
// Worker
// ----------------------------
const worker = new Worker(
  "post-like-queue",
  async (job) => {
    const { postId, userId, action, itemType = "post" } = job.data;

    if (!postId || !userId) {
      throw new Error("Missing parameters: postId or userId");
    }

    const Model = itemType === "blog" ? Blog : itemType === "template" ? ButtonTemplate : Post;
    const countField = itemType === "blog" ? "likesCount" : "likeCount";
    const arrayField = itemType === "blog" ? "likes" : "likedBy";

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

console.log("🚀 Post Like Worker Running...");
