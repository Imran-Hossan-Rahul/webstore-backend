// controllers/imageUploadController.js
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import User from "../models/User.model.js";
import CreatorProfile from "../models/CreatorProfile.model.js";
import { profileImageQueue } from "../queues/index.js";
import { postImageQueue } from "../queues/postImageQueue.js";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = "uploads/temp";
    try {
      await fs.mkdir(uploadDir, { recursive: true });
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

    // Verify file exists before queueing
    const fs = await import('fs');
    const fileExists = fs.existsSync(req.file.path);
    
    if (!fileExists) {
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

    // Add job to queue
    const job = await profileImageQueue.add(
      "process-cover-image",
      {
        filePath: req.file.path,
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
 * Upload creator profile picture
 * @route POST /api/v1/upload/creator/profile-picture
 */
export const uploadCreatorProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;

    // Add job to queue
    const job = await profileImageQueue.add(
      "process-profile-image",
      {
        filePath: req.file.path,
        type: "profile",
        userId: userId.toString(),
        targetModel: "creator",
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
      message: "Creator profile picture upload queued successfully",
      data: {
        jobId: job.id,
        status: "processing",
      },
    });

  } catch (error) {
    console.error("Upload creator profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to queue creator profile picture upload",
      error: error.message,
    });
  }
};

/**
 * Upload creator cover picture
 * @route POST /api/v1/upload/creator/cover-picture
 */
export const uploadCreatorCoverPicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;

    // Add job to queue
    const job = await profileImageQueue.add(
      "process-cover-image",
      {
        filePath: req.file.path,
        type: "cover",
        userId: userId.toString(),
        targetModel: "creator",
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
      message: "Creator cover picture upload queued successfully",
      data: {
        jobId: job.id,
        status: "processing",
      },
    });

  } catch (error) {
    console.error("Upload creator cover picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to queue creator cover picture upload",
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
 * Upload post image
 * @route POST /api/v1/upload/post-image
 */
export const uploadPostImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.user._id;
    // We expect postId if we are attaching to an existing post, 
    // BUT for new posts, we might upload FIRST, get a Temp URL, and then Create Post.
    // However, the user specifically said "image url post er model e add hoi" via worker.
    // This implies the worker needs the Post ID to update it.
    // So this endpoint MUST be called APTER the post is created? 
    // OR we pass a "tempPostId" if we want to get fancy, but let's stick to:
    // 1. User creates Post (text only or empty images). Returns Post ID.
    // 2. User uploads images with Post ID. Worker processes and updates Post.
    
    // WAIT, if the user picks images in the UI, they expect them to be there when they click "Post".
    // If we want "Post Image Worker" to update the model, we can:
    // A) Create Post -> Get ID -> Upload Images with ID -> Worker updates Post.
    // This seems to match the requirement "image url post er model e add hoi".

    const { postId } = req.body;
    if (!postId) {
        return res.status(400).json({ success: false, message: "Post ID is required" });
    }

    const job = await postImageQueue.add(
      "post-image-upload",
      {
        filePath: req.file.path,
        postId: postId,
        userId: userId
      },
      {
        removeOnComplete: true,
        attempts: 3
      }
    );

    res.status(202).json({
      success: true,
      message: "Post image upload queued",
      data: { jobId: job.id }
    });

  } catch (error) {
    console.error("Upload post image error:", error);
    res.status(500).json({ success: false, message: "Failed to queue post image upload" });
  }
};
