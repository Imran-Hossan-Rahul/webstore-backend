import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const devlogResourceQueue = new Queue("devlog-resource-upload", { connection: redis });


devlogResourceQueue.on('error', () => {});
