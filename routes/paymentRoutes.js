import express from "express";
import {
  createPaymentSession,
  handleStripeWebhook,
  verifyPayment,
  getPurchaseHistory,
  getPaymentMethods,
  submitPaymentProof,
  verifyManualPayment,
  getPendingManualPayments,
} from "../controllers/paymentController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import multer from "multer";

const router = express.Router();

// Configure multer for file uploads (payment proof screenshots)
const upload = multer({
  dest: "uploads/payment-proofs/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Webhook endpoint (raw body is handled in server.js)
router.post("/webhook", handleStripeWebhook);

// Public routes
router.get("/methods", getPaymentMethods);

// Protected routes
router.post("/create-session", verifyAccessToken, createPaymentSession);
router.get("/verify", verifyAccessToken, verifyPayment);
router.get("/history", verifyAccessToken, getPurchaseHistory);
router.post("/submit-proof", verifyAccessToken, upload.single("screenshot"), submitPaymentProof);

// Admin routes
router.get("/pending-verifications", verifyAccessToken, getPendingManualPayments);
router.post("/verify/:transactionId", verifyAccessToken, verifyManualPayment);

export default router;

