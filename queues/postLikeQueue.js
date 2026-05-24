import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const postLikeQueue = new Queue("post-like-queue", { connection: redis });
