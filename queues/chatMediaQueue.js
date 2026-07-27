import { Queue } from "bullmq";
import redis from "../config/redis.js";

// Singleton Queue — shared across the process
export const chatMediaQueue = new Queue("chat-media-upload", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

chatMediaQueue.on('error', () => {});
