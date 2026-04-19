import rateLimit from "express-rate-limit";


export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  message: { success: false, message: "Too many requests, try again later" },
});
