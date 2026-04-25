import { NODE_ENV } from "../config/index.js";

/**
 * Enforce HTTPS in production
 */
export const enforceHTTPS = (req, res, next) => {
  if (NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

/**
 * Additional security headers
 */
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
};

/**
 * Remove sensitive headers
 */
export const removeSensitiveHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  next();
};
