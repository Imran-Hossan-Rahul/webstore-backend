import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import ButtonTemplate from "../models/Template.model.js";





// ----------------------------
// Worker
// ----------------------------
const worker = new Worker(
  "like-queue",
  async (job) => {
    const { templateId, userId, action } = job.data;

    if (!templateId || !userId) {
      throw new Error("Missing parameters: templateId or userId");
    }

    // ----------------------------
    // LIKE
    // ----------------------------
    if (action === "like") {
      const updated = await ButtonTemplate.findOneAndUpdate(
        {
          _id: templateId,
          likedBy: { $ne: userId }, // ইউজার আগে লাইক দেয়নি
        },
        {
          $addToSet: { likedBy: userId },
          $inc: { likeCount: 1 },
        },
        { new: true }
      );

      if (!updated) {
        console.log("User already liked this template");
      } else {
        console.log(`Template ${templateId} liked by user ${userId}`);
      }
    }

    // ----------------------------
    // UNLIKE
    // ----------------------------
    if (action === "unlike") {
      const updated = await ButtonTemplate.findOneAndUpdate(
        {
          _id: templateId,
          likedBy: userId, // ইউজার আগে লাইক দিয়েছে
        },
        {
          $pull: { likedBy: userId },
          $inc: { likeCount: -1 },
        },
        { new: true }
      );

      if (updated) {
        console.log(`Template ${templateId} unliked by user ${userId}`);
      }
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 20 }
);

console.log("🚀 Like Worker Running (Login Users Only)...");
