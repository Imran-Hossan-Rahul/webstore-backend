import Logger from "../utils/logger.js";

const validationAttempts = {};
const RATE_LIMIT = 10; // max attempts
const WINDOW_MS = 60 * 1000; // 1 min

export const validate =
  (schema, lang = "en") =>
  async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (validationAttempts[ip]) {
      validationAttempts[ip] = validationAttempts[ip].filter(
        (ts) => now - ts < WINDOW_MS
      );
      if (validationAttempts[ip].length === 0) {
        delete validationAttempts[ip];
      }
    }

    const currentAttempts = validationAttempts[ip] || [];
    if (currentAttempts.length >= RATE_LIMIT) {
      Logger.warn(`⚠️ Validation rate-limit exceeded for IP: ${ip}`);
      return res.status(429).json({
        success: false,
        message: "Too many validation attempts. Please try again later.",
      });
    }
    
    if (!validationAttempts[ip]) {
      validationAttempts[ip] = [];
    }
    validationAttempts[ip].push(now);

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const formattedErrors = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
        type: d.type,
      }));
      Logger.info(`Validation failed for IP: ${ip}`, formattedErrors);
      return res.status(400).json({ success: false, errors: formattedErrors });
    }

    req.validatedBody = value;
    next();
  };
