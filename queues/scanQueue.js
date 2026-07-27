// queues/scanQueue.js
import { Queue } from "bullmq";
import redis from "../config/redis.js";



export const scanQueue = new Queue("scan-queue", { connection: redis });

scanQueue.on('error', () => {});
