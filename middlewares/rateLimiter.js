import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

/**
 * Generic rate limiter factory
 */
const createLimiter = (windowMs, max, message) => {
  // Rate limiting has been disabled as per request
  return (req, res, next) => {
    next();
  };
};

// 🔒 Auth Limiter: Prevent brute-force on login/register
export const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 requests per window
  "Too many authentication attempts. Please try again in 15 minutes."
);

// 📤 Upload Limiter: Prevent storage exhaustion/spam
export const uploadLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  30, // 30 uploads per hour
  "Upload limit reached. Please try again later."
);

// ✅ Verification Limiter: Prevent reward spam
export const verificationLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 attempts per hour
  "Verification submission limit reached. Please wait before trying again."
);

// 🌐 Global API Limiter: General DDoS protection
export const apiLimiter = createLimiter(
  1 * 60 * 1000, // 1 minute
  100, // 100 requests per minute
  "Too many requests from this IP, please try again in a minute."
);

// 💰 Token Reward Limiter
export const tokenRewardLimiter = createLimiter(
  24 * 60 * 60 * 1000, // 24 hours
  5, // 5 rewards per day
  "Daily reward limit reached. Please come back tomorrow."
);

