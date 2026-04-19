import Queue from "bull";
import ButtonTemplate from "../models/Template.model.js";

export const likeQueue = new Queue("like-queue", {
  redis: { port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379, host: process.env.REDIS_HOST || "127.0.0.1" },
});

// Worker
likeQueue.process("like-task", async (job) => {
  const { templateId, userId, action } = job.data;

  const update =
    action === "like"
      ? { 
          $inc: { likeCount: 1 }, 
          $addToSet: { likedBy: userId },
          $push: { likeHistory: { userId, timestamp: new Date() } }
        }
      : { 
          $inc: { likeCount: -1 }, 
          $pull: { likedBy: userId } 
        };

  await ButtonTemplate.findByIdAndUpdate(templateId, update);
});
