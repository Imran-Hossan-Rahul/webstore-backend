// routes/authRoutes.js
import express from "express";
import asyncHandler from "express-async-handler";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  refreshTokenHandler,
  logoutHandler,
  getUserCount,
  verifyEmail,
  resendVerificationEmail,
  verify2FALogin,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { validate } from "../middlewares/validate.js";
import { registerSchema, loginSchema } from "../validation/authValidation.js";
import logger from "../utils/logger.js";
import { NODE_ENV } from "../config/index.js";
import { adminOnly, protect } from "../middlewares/authMiddleware.js";
import { createAdminUserController } from "../controllers/authController.js";
import authLimiter from "../utils/authLimiter.js";


const router = express.Router();

// Rate limiter
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: {
//     success: false,
//     message: `Too many requests from this IP, try again after ${authLimiter.windowMs}`,
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Audit wrapper
const auditWrapper = (controller) =>
  asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    try {
      await controller(req, res, next);
      const duration = Date.now() - startTime;
      logger.info({
        event: "controller_executed",
        controller: controller.name,
        ip: req.ip,
        path: req.originalUrl,
        durationMs: duration,
        status: res.statusCode,
      });
    } catch (error) {
      logger.error({
        event: "controller_error",
        controller: controller.name,
        ip: req.ip,
        path: req.originalUrl,
        message: error.message,
        stack: error.stack,
      });
      next(error);
    }
  });

// Routes
router.post(
  "/register",
  authLimiter,
  validate(registerSchema()),
  auditWrapper(registerUser)
);
router.post(
  "/login",
  authLimiter,
  validate(loginSchema()),
  auditWrapper(loginUser)
);

router.post(
  "/verify-2fa-login",
  authLimiter,
  auditWrapper(verify2FALogin)
);

// Refresh token with rotation
// 🔒 FIX: refreshTokenHandler sends its own complete response — DO NOT wrap with additional res.json()
router.post("/refresh-token", auditWrapper(refreshTokenHandler));

router.post(
  "/admin/create-user",
  protect, // JWT verify + attach user
  adminOnly, // Only admin or super admin allowed
  auditWrapper(createAdminUserController)
);


router.get("/count", getUserCount);


// Email Verification
router.get("/verify-email", auditWrapper(verifyEmail));
router.post("/resend-verification", protect, authLimiter, auditWrapper(resendVerificationEmail));

// Password Recovery
router.post("/forgot-password", authLimiter, auditWrapper(forgotPassword));
router.post("/reset-password", authLimiter, auditWrapper(resetPassword));



router.post("/logout", auditWrapper(logoutHandler));

export default router;
