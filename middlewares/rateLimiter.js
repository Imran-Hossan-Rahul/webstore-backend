import rateLimit from "express-rate-limit";

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Reduced from 10 to 5 attempts
  message: { 
    success: false, 
    message: "Too many authentication attempts. Please try again after 15 minutes." 
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests from counting
  skipSuccessfulRequests: true,
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: { 
    success: false, 
    message: "Too many requests. Please try again later." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: { 
    success: false, 
    message: "Upload limit exceeded. Please try again later." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment endpoint limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: { 
    success: false, 
    message: "Too many payment attempts. Please contact support if you need assistance." 
  },
  standardHeaders: true,
  legacyHeaders: false,
});
