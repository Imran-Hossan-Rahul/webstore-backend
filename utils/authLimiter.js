import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 মিনিট
  max: 10,
  standardHeaders: true, // 'Retry-After' হেডার পাঠাবে
  legacyHeaders: false,
  message: (req, res) => {
    const retryAfterSec = Math.ceil(res.getHeader("Retry-After") || 0);
    return {
      success: false,
      message: `Too many requests. Try again after ${Math.floor(
        retryAfterSec / 60
      )} minutes.`,
    };
  },
});

export default authLimiter;
