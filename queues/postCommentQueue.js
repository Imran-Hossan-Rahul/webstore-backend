import { Queue } from "bullmq";
import redis from "../config/redis.js";



export const postCommentQueue = new Queue("post-comment-queue", { connection: redis });
