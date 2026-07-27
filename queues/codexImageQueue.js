// queues/codexImageQueue.js
import { Queue } from "bullmq";
import redis from "../config/redis.js";



export const codexImageQueue = new Queue("codex-image-upload", { 
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200,     // Keep last 200 failed jobs
  }
});


codexImageQueue.on('error', () => {});
