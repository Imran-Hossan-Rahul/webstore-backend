// db.js (Ultra Enterprise-Grade)
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { MONGODB_CONNECTION_STRING } from "./index.js";

const MongoDB = MONGODB_CONNECTION_STRING;

if (!MongoDB) {
  throw new Error("❌ Please define MongoDB in your .env file");
}

// ---- Global cache for serverless ----
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, circuitOpen: false };
}

// ---- Mongoose strict mode ----
mongoose.set("strictQuery", true);
mongoose.set("strictPopulate", true);

// ---- Circuit breaker constants ----
const CIRCUIT_OPEN_DURATION = 30 * 1000; // 30 sec
const HEALTHCHECK_INTERVAL = 15000; // 15 sec

// ---- Exponential backoff connection ----
async function connectWithRetry(retries = 5, delay = 2000) {
  if (cached.circuitOpen) {
    logger.warn("⚠️ Circuit breaker active, skipping DB connect attempt");
    throw new Error("Circuit breaker: DB connection blocked temporarily");
  }
  try {
    await mongoose.connect(MongoDB, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000, // Increased from 10s to 30s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000, // Added explicit connect timeout
      retryWrites: true,
      w: "majority",
    });

    logger.info("✅ MongoDB connected successfully");
    return mongoose;
  } catch (err) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    if (retries <= 0) {
      logger.error(
        "🚨 All MongoDB connection attempts failed. Activating circuit breaker."
      );
      cached.circuitOpen = true;
      setTimeout(() => {
        cached.circuitOpen = false;
        logger.info("🔹 Circuit breaker reset, retrying DB connections");
      }, CIRCUIT_OPEN_DURATION);

      throw err;
    }
    logger.warn(`⏳ Retrying in ${delay / 1000}s... (${retries} retries left)`);
    await new Promise((res) => setTimeout(res, delay));
    return connectWithRetry(retries - 1, delay * 2);
  }
}
// ---- Periodic health probe ----
function startHealthCheck() {
  setInterval(async () => {
    try {
      await mongoose.connection.db.admin().ping();
      logger.info("🔹 MongoDB healthcheck: OK");
    } catch (err) {
      logger.error("❌ MongoDB healthcheck failed: " + err.message);
    }
  }, HEALTHCHECK_INTERVAL);
}
// ---- Main connection function ----
export async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = connectWithRetry()
      .then((conn) => {
        cached.conn = conn;
        startHealthCheck();
        return conn;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;

  // ---- Event listeners ----
  mongoose.connection.on("disconnected", async () => {
    logger.warn("⚠️ MongoDB disconnected. Attempting automatic reconnect...");
    try {
      await connectWithRetry(5, 2000);
    } catch (err) {
      logger.error("❌ Reconnection failed after disconnect: " + err.message);
    }
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("✅ MongoDB reconnected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error(` MongoDB error: ${err.message}`);
  });

  mongoose.connection.on("close", () => {
    logger.warn("⚠️ MongoDB connection closed");
  });

  mongoose.connection.on("fullsetup", () => {
    logger.info("🔹 MongoDB replica set fully connected");
  });

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    try {
      await mongoose.connection.close(false); // don't force close, allow pending ops
      logger.info("🔌 MongoDB connection closed due to app termination");
      process.exit(0);
    } catch (err) {
      logger.error("❌ Error during MongoDB shutdown: " + err.message);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return cached.conn;
}

// ---- Healthcheck helper ----
export function isDatabaseConnected() {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  return mongoose.connection.readyState === 1;
}
