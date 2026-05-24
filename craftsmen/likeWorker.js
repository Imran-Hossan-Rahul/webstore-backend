import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Artifact from "../models/Artifact.model.js";





// ----------------------------
// Craftsman
// ----------------------------
const craftsman = new Craftsman(
  "like-queue",
  async (job) => {
    const { artifactId, userId, action } = job.data;

    if (!artifactId || !userId) {
      throw new Error("Missing parameters: artifactId or userId");
    }

    // ----------------------------
    // LIKE
    // ----------------------------
    if (action === "like") {
      const updated = await Artifact.findOneAndUpdate(
        {
          _id: artifactId,
          likedBy: { $ne: userId }, // ইউজার আগে লাইক দেয়নি
        },
        {
          $addToSet: { likedBy: userId },
          $inc: { likeCount: 1 },
        },
        { new: true }
      );

      if (!updated) {
        console.log("User already liked this artifact");
      } else {
        console.log(`Artifact ${artifactId} liked by user ${userId}`);
      }
    }

    // ----------------------------
    // UNLIKE
    // ----------------------------
    if (action === "unlike") {
      const updated = await Artifact.findOneAndUpdate(
        {
          _id: artifactId,
          likedBy: userId, // ইউজার আগে লাইক দিয়েছে
        },
        {
          $pull: { likedBy: userId },
          $inc: { likeCount: -1 },
        },
        { new: true }
      );

      if (updated) {
        console.log(`Artifact ${artifactId} unliked by user ${userId}`);
      }
    }

    return { status: "done" };
  },
  { connection: redis, concurrency: 20 }
);

console.log("🚀 Like Craftsman Running (Login Users Only)...");


