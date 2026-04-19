import { Worker } from "bullmq";
import redis from "../config/redis.js";
import sharp from "sharp";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up one level from workers/ to backend/
const backendRoot = path.resolve(__dirname, '..');

console.log(`🔧 Worker starting from: ${__dirname}`);
console.log(`🔧 Backend root set to: ${backendRoot}`);

// Connect to Database
connectToDatabase()
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker failed to connect to MongoDB:", err));

// Redis connection


// Queue events for monitoring

// Worker
const worker = new Worker(
  "profile-image-upload",
  async (job) => {
    console.log(`🛠️ Processing profile image job: ${job.id}`);
    
    // Wait a bit to ensure file is fully saved by multer
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { filePath, type, userId, targetModel } = job.data;
    // type: "profile" or "cover"
    // targetModel: "user" or "creator"

    console.log(`📦 Job data:`, { filePath, type, userId, targetModel });

    if (!filePath) {
      throw new Error("File path missing");
    }

    // Resolve absolute path - handle Windows paths properly
    let absolutePath;
    if (path.isAbsolute(filePath)) {
      absolutePath = filePath;
    } else {
      // Always resolve from backendRoot, not from current directory
      absolutePath = path.join(backendRoot, filePath);
    }

    console.log(`📁 Backend root: ${backendRoot}`);
    console.log(`📁 Original file path: ${filePath}`);
    console.log(`📁 Resolved absolute path: ${absolutePath}`);
    console.log(`📂 File exists: ${fs.existsSync(absolutePath)}`);

    // List files in uploads/temp to debug
    const tempDir = path.join(backendRoot, 'uploads', 'temp');
    console.log(`📂 Temp directory: ${tempDir}`);
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      console.log(`📂 Files in temp:`, files.slice(0, 5)); // Show first 5 files
    }

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      // Update progress: Starting processing
      await job.updateProgress(10);

      // Process image with Sharp
      const processedPath = path.join(
        path.dirname(absolutePath),
        `processed_${type}_${userId}_${Date.now()}.jpg`
      );

      console.log(`🖼️ Processing ${type} image...`);

      if (type === "profile") {
        // Profile: 400x400 square
        await sharp(absolutePath)
          .resize(400, 400, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 90, progressive: true })
          .toFile(processedPath);
      } else {
        // Cover: 1500x500 (3:1 ratio)
        await sharp(absolutePath)
          .resize(1500, 500, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 85, progressive: true })
          .toFile(processedPath);
      }

      await job.updateProgress(40);

      // Upload to Cloudinary
      const folder = type === "profile" ? "profile_pictures" : "cover_pictures";
      console.log(`📤 Uploading to Cloudinary: ${folder}`);

      const transformation = type === "profile"
        ? [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ]
        : [
            { width: 1500, height: 500, crop: "fill" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ];

      const uploaded = await cloudinary.uploader.upload(processedPath, {
        folder: folder,
        public_id: `${type}_${userId}_${Date.now()}`,
        transformation: transformation,
      });

      console.log(`☁️ Uploaded to Cloudinary: ${uploaded.secure_url}`);
      await job.updateProgress(90);

      // Update database
      if (targetModel === "user") {
        const User = (await import("../models/User.model.js")).default;
        const user = await User.findById(userId);
        if (user) {
          if (type === "profile") {
            user.profilePicture = uploaded.secure_url;
          } else {
            user.coverPicture = uploaded.secure_url;
          }
          await user.save();
          console.log(`✅ User ${type} picture updated in database`);

          // SYNC: If user is also a creator, update CreatorProfile too
          if (user.hasCreatorAccount) {
             try {
                const CreatorProfile = (await import("../models/CreatorProfile.model.js")).default;
                const creatorProfile = await CreatorProfile.findOne({ userId });
                if (creatorProfile) {
                   if (type === "profile") {
                      creatorProfile.profilePicture = uploaded.secure_url;
                   } else {
                      creatorProfile.coverPicture = uploaded.secure_url;
                   }
                   await creatorProfile.save();
                   console.log(`🔄 Synced ${type} picture to CreatorProfile for user ${userId}`);
                }
             } catch (syncErr) {
                console.error("Failed to sync to CreatorProfile:", syncErr);
                // Don't fail the job, just log error
             }
          }
        }
      } else if (targetModel === "creator") {
        const CreatorProfile = (await import("../models/CreatorProfile.model.js")).default;
        const creatorProfile = await CreatorProfile.findOne({ userId });
        if (creatorProfile) {
          if (type === "profile") {
            creatorProfile.profilePicture = uploaded.secure_url;
          } else {
            creatorProfile.coverPicture = uploaded.secure_url;
          }
          await creatorProfile.save();
          console.log(`✅ Creator ${type} picture updated in database`);
        }
      }

      // Clean up temp files
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 Original file cleaned: ${absolutePath}`);
      }
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
        console.log(`🧹 Processed file cleaned: ${processedPath}`);
      }

      await job.updateProgress(100);

      // Return result
      return {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        type: type,
        targetModel: targetModel,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      // Clean up temp files on error
      // Do NOT delete absolutePath here so retries can find the file
      // if (fs.existsSync(absolutePath)) {
      //   fs.unlinkSync(absolutePath);
      // }
      const processedPath = path.join(
        path.dirname(absolutePath),
        `processed_${type}_${userId}_${Date.now()}.jpg`
      );
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
      console.error(`❌ Upload error for job ${job.id}:`, error);
      throw error;
    }
  },
  { connection: redis,
    concurrency: 15, // Process 15 uploads simultaneously
    limiter: {
      max: 100,      // Max 100 jobs
      duration: 1000 // Per second
    }
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Worker finished job ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Worker job ${job.id} failed:`, err.message);
});

console.log("🚀 Profile Image Upload Worker Started");
console.log("⚙️  Concurrency: 15 workers");
console.log("⏱️  Rate limit: 100 uploads/second");
