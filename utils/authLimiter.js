import rateLimit from "express-rate-limit";

const authLimiter = (req, res, next) => {
  next();
};

export default authLimiter;
