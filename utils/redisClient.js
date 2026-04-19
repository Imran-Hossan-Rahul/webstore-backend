// backend/utils/redisClient.js
import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = process.env.REDIS_PORT
  ? parseInt(process.env.REDIS_PORT, 10)
  : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

const options = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
};
if (REDIS_PASSWORD) options.password = REDIS_PASSWORD;

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });

redis.on("connect", () =>
  console.log(`✅ Redis connected ${REDIS_HOST}:${REDIS_PORT}`)
);
redis.on("error", (err) => console.error("❌ Redis error:", err));

export default redis;
