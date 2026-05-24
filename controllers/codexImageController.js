import { codexImageQueue } from "../queues/codexImageQueue.js";
import fs from "fs";

/**
 * Queue codex cover image upload to Cloudinary
 * @route POST /api/v1/codex/upload-cover-image
 * @access Private
 */
export const uploadCoverImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No image file provided" 
      });
    }

    const file = req.file;

    // Validate file type
    if (!file.mimetype.startsWith("image/")) {
      // Delete temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ 
        success: false,
        message: "Only image files are allowed" 
      });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Image size must be less than 5MB"
      });
    }

    // Add to queue
    const job = await codexImageQueue.add("upload", {
      filePath: file.path,
      originalName: file.originalname,
      userId: req.user?._id || req.user?.id,
    });

    return res.status(202).json({
      success: true,
      message: "Upload queued successfully",
      jobId: job.id,
      status: "queued"
    });
  } catch (error) {
    console.error("❌ Queue upload error:", error);
    
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ 
      success: false,
      message: "Failed to queue upload",
      error: error.message 
    });
  }
};

/**
 * Get upload job status
 * @route GET /api/v1/codex/upload-status/:jobId
 * @access Private
 */
export const getUploadStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await codexImageQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const returnValue = job.returnvalue;

    return res.status(200).json({
      success: true,
      jobId: job.id,
      status: state, // 'waiting', 'active', 'completed', 'failed'
      progress,
      url: returnValue?.url,
      publicId: returnValue?.publicId,
      uploadedAt: returnValue?.uploadedAt
    });
  } catch (error) {
    console.error("❌ Get upload status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get upload status",
      error: error.message
    });
  }
};

