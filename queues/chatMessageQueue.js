import { Queue } from "bullmq";
import redis from "../config/redis.js";

/**
 * Chat Message Queue
 * Handles high-volume concurrent message persistence.
 * The HTTP handler does an optimistic DB write (fast path),
 * but for fan-out notifications and analytics we offload to this queue.
 */
export const chatMessageQueue = new Queue("chat-message", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  },
});
