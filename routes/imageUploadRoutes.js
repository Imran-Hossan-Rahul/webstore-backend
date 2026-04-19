// routes/imageUploadRoutes.js
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  upload,
  uploadUserProfilePicture,
  uploadUserCoverPicture,
  uploadCreatorProfilePicture,
  uploadCreatorCoverPicture,
  getUploadStatus,
  uploadPostImage,
} from "../controllers/imageUploadController.js";

const router = express.Router();

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

// Creator image uploads
router.post(
  "/creator/profile-picture",
  protect,
  upload.single("image"),
  uploadCreatorProfilePicture
);

router.post(
  "/creator/cover-picture",
  protect,
  upload.single("image"),
  uploadCreatorCoverPicture
);

router.post(
  "/post-image",
  protect,
  upload.single("image"),
  uploadPostImage
);

router.get("/status/:jobId", protect, getUploadStatus);

export default router;
