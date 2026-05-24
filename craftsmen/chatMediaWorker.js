import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

console.log("🔧 Chat Media Craftsman starting...");

connectToDatabase()
  .then(() => console.log("✅ Chat Media Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Chat Media Craftsman DB connection failed:", err));

/**
 * Chat Media Craftsman
 * Processes chat file uploads from disk → Cloudinary → DB update → socket emit.
 *
 * Job data shape:
 *   { filePath, chatId, messageId, senderId, mediaType, originalName }
 *
 * Concurrency: 20 — handles 20 simultaneous uploads
 * Rate limit:  200 jobs/s — prevents Cloudinary API abuse
 */
const craftsman = new Craftsman(
  "chat-media-upload",
  async (job) => {
    const { filePath, chatId, messageId, senderId, mediaType, originalName } = job.data;

    if (!filePath || !chatId || !messageId) {
      throw new Error(`[Job ${job.id}] Missing required fields: filePath, chatId, messageId`);
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(backendRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`[Job ${job.id}] File not found: ${absolutePath}`);
    }

    await job.updateProgress(10);

    // ── 1. Determine Cloudinary upload options ──────────────────────────────
    const uploadOptions = {
      folder: "chat_media",
      public_id: `chat_${chatId}_${messageId}_${Date.now()}`,
      use_filename: false,
    };

    if (mediaType === "image") {
      uploadOptions.resource_type = "image";
      uploadOptions.quality = "auto:good";
      uploadOptions.fetch_format = "auto";
      uploadOptions.transformation = [
        { width: 1280, crop: "limit" }, // max 1280px wide, never upscale
        { quality: "auto:good" },
      ];
    } else if (mediaType === "video") {
      uploadOptions.resource_type = "video";
      uploadOptions.quality = "auto";
    } else {
      // PDF, DOC, ZIP, etc.
      uploadOptions.resource_type = "auto";
      uploadOptions.use_filename = true;
    }

    console.log(`📤 [Job ${job.id}] Uploading ${mediaType} → Cloudinary`);

    // ── 2. Upload to Cloudinary ─────────────────────────────────────────────
    const uploaded = await cloudinary.uploader.upload(absolutePath, uploadOptions);
    const cloudinaryUrl = uploaded.secure_url;

    console.log(`☁️  [Job ${job.id}] Uploaded: ${cloudinaryUrl}`);
    await job.updateProgress(70);

    // ── 3. Update the Message document with the real Cloudinary URL ─────────
    const Message = (await import("../models/Message.model.js")).default;
    await Message.findByIdAndUpdate(messageId, {
      fileUrl: cloudinaryUrl,
      fileSize: uploaded.bytes,
    });

    await job.updateProgress(85);

    // ── 4. Emit socket event so both patrons get the real URL instantly ──────
    const { getIO } = await import("../utils/socketManager.js");
    const io = getIO();
    if (io) {
      io.to(chatId).emit("message:mediaReady", {
        messageId,
        chatId,
        fileUrl: cloudinaryUrl,
        fileSize: uploaded.bytes,
      });
    }

    // ── 5. Cleanup disk file ────────────────────────────────────────────────
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 [Job ${job.id}] Cleaned up local file`);
      }
    } catch (cleanupErr) {
      console.error(`⚠️  [Job ${job.id}] Cleanup failed (non-fatal):`, cleanupErr.message);
    }

    await job.updateProgress(100);

    return { messageId, chatId, cloudinaryUrl };
  },
  {
    connection: redis,
    concurrency: 20,        // 20 simultaneous Cloudinary uploads
    limiter: {
      max: 200,             // 200 jobs per second max
      duration: 1000,
    },
  }
);

craftsman.on("completed", (job, result) => {
  console.log(`✅ [Job ${job.id}] Chat media uploaded: ${result.cloudinaryUrl}`);
});

craftsman.on("failed", (job, err) => {
  console.error(`❌ [Job ${job.id}] Chat media upload failed:`, err.message);
});

craftsman.on("stalled", (jobId) => {
  console.warn(`⚠️  Job ${jobId} stalled — will be retried`);
});

console.log("🚀 Chat Media Craftsman Started  |  concurrency=20  |  limit=200/s");
