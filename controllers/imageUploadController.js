// controllers/imageUploadController.js
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import User from "../models/User.model.js";

import { profileImageQueue } from "../queues/index.js";


// Configure multer for file upload
import fsSync from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/temp";
    try {
      if (!fsSync.existsSync(uploadDir)) {
        fsSync.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: fileFilter,
});

/**
 * Upload user profile picture
 * @route POST /api/v1/upload/user/profile-picture
 */
export const uploadUserProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;
    const filePath = req.file.path;

    // Verify file exists before queueing
    try {
      await fs.access(filePath);
    } catch {
      return res.status(500).json({
        success: false,
        message: "File upload failed - file not saved",
      });
    }

    // Add job to queue
    const job = await profileImageQueue.add(
      "process-profile-image",
      {
        filePath: req.file.path,
        type: "profile",
        userId: userId.toString(),
        targetModel: "user",
      },
      {
        removeOnComplete: { age: 3600 }, // Keep for 1 hour so frontend can poll status
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );

    conso


    // Return immediate response
    res.status(202).json({
      success: true,
      message: "Profile picture upload queued successfully",
      data: {
        jobId: job.id,
        status: "processing",
      },
    });

  } catch (error) {
    console.error("Upload user profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to queue profile picture upload",
      error: error.message,
    });
  }
};

/**
 * Upload user cover picture
 * @route POST /api/v1/upload/user/cover-picture
 */
export const uploadUserCoverPicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;

    const filePath = req.file.path;

    // Add job to queue
    const job = await profileImageQueue.add(
      "process-cover-image",
      {
        filePath,
        type: "cover",
        userId: userId.toString(),
        targetModel: "user",
      },
      {
        removeOnComplete: { age: 3600 }, // Keep for 1 hour so frontend can poll status
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      }
    );


    // Return immediate response
    res.status(202).json({
      success: true,
      message: "Cover picture upload queued successfully",
      data: {
        jobId: job.id,
        status: "processing",
      },
    });

  } catch (error) {
    console.error("Upload user cover picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to queue cover picture upload",
      error: error.message,
    });
  }
};




/**
 * Get upload job status
 * @route GET /api/v1/upload/status/:jobId
 */
export const getUploadStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await profileImageQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        state,
        result,
        failedReason,
      },
    });
  } catch (error) {
    console.error("Get upload status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get upload status",
      error: error.message,
    });
  }
};

/**
 * Generic image upload
 * @route POST /api/v1/upload/image
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Return the path so frontend can use it
    // In a real app, this might be a Cloudinary/S3 URL
    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: `/${req.file.path.replace(/\\/g, "/")}`
    });
  } catch (error) {
    console.error("Generic image upload error:", error);
    res.status(500).json({ success: false, message: "Failed to upload image" });
  }
};

