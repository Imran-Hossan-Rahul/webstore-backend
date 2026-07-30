// routes/imageUploadRoutes.js
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  upload,
  uploadUserProfilePicture,
  uploadUserCoverPicture,
  getUploadStatus,
  uploadImage,
} from "../controllers/imageUploadController.js";
import { uploadLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Apply limiter to all POST routes in this router
router.use(uploadLimiter);

// User image uploads
router.post(
  "/user/profile-picture",
  protect,
  upload.single("image"),
  uploadUserProfilePicture
);

router.post(
  "/user/cover-picture",
  protect,
  upload.single("image"),
  uploadUserCoverPicture
);





router.post(
  "/image",
  protect,
  upload.single("image"),
  uploadImage
);

router.get("/status/:jobId", protect, getUploadStatus);

export default router;
