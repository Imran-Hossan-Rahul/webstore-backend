import Queue from "bull";
import Artifact from "../models/Artifact.model.js";

export const likeQueue = new Queue("like-queue", {
  redis: { port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379, host: process.env.REDIS_HOST || "127.0.0.1" },
});

// Craftsman
likeQueue.process("like-task", async (job) => {
  const { artifactId, userId, action } = job.data;

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

  const updatedArtifact = await Artifact.findByIdAndUpdate(artifactId, update, { new: true });

  if (action === "like" && updatedArtifact) {
    const authorId = updatedArtifact.author;
    if (authorId && authorId.toString() !== userId.toString()) {
      const GamificationService = (await import("../services/GamificationService.js")).default;
      await GamificationService.awardRewards(authorId.toString(), 'GET_LIKE').catch(err => console.error("XP Error:", err));
    }
  }
});



likeQueue.on('error', () => {});
