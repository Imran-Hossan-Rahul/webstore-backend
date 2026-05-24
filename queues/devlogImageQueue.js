import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const devlogImageQueue = new Queue("post-image-upload", { connection: redis });
