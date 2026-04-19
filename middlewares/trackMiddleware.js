import rateLimit from "express-rate-limit";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * ----------------------------
 * Bot Filter Middleware
 * ----------------------------
 * Prevents common bots from hitting tracking endpoints
 * Whitelist: Googlebot, Bingbot, Yandexbot
 */

export const trackRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  message: { success: false, message: "Rate limit exceeded" },
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
});

export const trackBotFilter = (req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  const whitelist = [/googlebot/i, /bingbot/i, /yandexbot/i];
  const botPatterns = [
    /bot/i,
    /spider/i,
    /crawl/i,
    /facebookexternalhit/i,
    /slackbot/i,
    /pingdom/i,
  ];

  const isWhitelisted = whitelist.some((p) => p.test(ua));
  const isBot = botPatterns.some((p) => p.test(ua));

  if (isBot && !isWhitelisted)
    return res.status(200).json({ success: true, skipped: "bot detected" });

  next();
};
/**
 * ----------------------------
 * Rate Limit Middleware
 * ----------------------------
 * Limits requests per IP per minute to prevent abuse
 * Can be extended to user-specific rate limits in future
 */
