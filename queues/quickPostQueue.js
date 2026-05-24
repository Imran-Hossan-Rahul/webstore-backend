import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const quickPostQueue = new Queue("quick-post-media", { connection: redis });
