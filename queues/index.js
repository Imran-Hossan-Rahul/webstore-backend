// backend/queues/index.js
import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const rankingQueue = new Queue("ranking-queue", { connection: redis });
export const flushQueue = new Queue("flush-queue", { connection: redis }); // optional: used to trigger flush jobs
export const profileImageQueue = new Queue("profile-image-upload", { connection: redis });

rankingQueue.on('error', () => {});
