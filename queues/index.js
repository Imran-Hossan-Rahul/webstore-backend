// backend/queues/index.js
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });

export const rankingQueue = new Queue("ranking-queue", { connection });
export const flushQueue = new Queue("flush-queue", { connection }); // optional: used to trigger flush jobs
export const profileImageQueue = new Queue("profile-image-upload", { connection });
