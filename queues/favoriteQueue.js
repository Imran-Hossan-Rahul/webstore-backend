import { Queue } from "bullmq";
import redis from "../config/redis.js";



export const favoriteQueue = new Queue("favorite-queue", { connection: redis });
