import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

// Redis connection


// Queue events for monitoring

// Craftsman
const craftsman = new Craftsman(
  "codex-image-upload",
  async (job) => {
    console.log(`🛠️ Processing image upload job: ${job.id}`);
    const { filePath, originalName, userId } = job.data;

    if (!filePath) {
      throw new Error("File path missing");
    }

    // Resolve absolute path - handle both absolute and relative paths
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(backendRoot, filePath);

    console.log(`📁 File path: ${absolutePath}`);
    console.log(`📂 File exists: ${fs.existsSync(absolutePath)}`);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      // Update progress: Starting upload
      await job.updateProgress(10);

      // Upload to Cloudinary
      console.log(`📤 Uploading to Cloudinary: ${originalName}`);
      const uploaded = await cloudinary.uploader.upload(absolutePath, {
        folder: "codex_covers",
        resource_type: "image",
        transformation: [
          { width: 1200, height: 630, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      });

      console.log(`☁️ Uploaded to Cloudinary: ${uploaded.secure_url}`);
      await job.updateProgress(90);

      // Clean up temp file
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 Temp file cleaned: ${absolutePath}`);
      }

      await job.updateProgress(100);

      // Return result
      return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
      console.error(`❌ Upload error for job ${job.id}:`, error);
      throw error;
    }
  },
  { connection: redis,
    concurrency: 10, // Process 10 uploads simultaneously
    limiter: {
      max: 50,      // Max 50 jobs
      duration: 1000 // Per second
    }
  }
);

craftsman.on("completed", (job) => {
  console.log(`✅ Craftsman finished job ${job.id}`);
});

craftsman.on("failed", (job, err) => {
  console.error(`❌ Craftsman job ${job.id} failed:`, err.message);
});

console.log("🚀 Codex Image Upload Craftsman Started");
console.log("⚙️  Concurrency: 10 craftsmans");
console.log("⏱️  Rate limit: 50 uploads/second");


craftsman.on('error', () => {});
