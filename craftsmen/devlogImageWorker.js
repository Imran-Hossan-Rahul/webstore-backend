import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";
import { getIO } from "../utils/socketManager.js";

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

console.log(`🔧 Image Craftsman starting from: ${__dirname}`);

// Connect to Database
connectToDatabase()
  .then(() => console.log("✅ Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Craftsman failed to connect to MongoDB:", err));

// Redis connection


// Queue events

// Craftsman
const craftsman = new Craftsman(
  "post-image-upload",
  async (job) => {
    console.log(`🛠️ Processing post image job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { filePath, postId, userId, targetType = "Post" } = job.data;

    if (!filePath || !postId) {
      throw new Error("Job data missing");
    }

    // Resolve path
    let absolutePath = path.isAbsolute(filePath) ? filePath : path.join(backendRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      await job.updateProgress(10);
      
      // Upload to Cloudinary
      console.log(`📤 Uploading to Cloudinary: ${targetType === "Challenge" ? "challenge_screenshots" : "post_images"}`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, {
        folder: targetType === "Challenge" ? "challenge_screenshots" : "post_images",
        public_id: `img_${postId}_${Date.now()}`,
        resource_type: "image",
        quality: "auto:good",
        fetch_format: "auto"
      });

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      if (targetType === "Challenge_Cover") {
          const Challenge = (await import("../models/Challenge.model.js")).default;
          const updatedChallenge = await Challenge.findByIdAndUpdate(
              postId,
              { coverImage: uploaded.secure_url },
              { new: true }
          );
          if (updatedChallenge) {
              console.log(`✅ Challenge ${postId} cover image updated`);
          }
      } else if (targetType === "Challenge") {
          const Challenge = (await import("../models/Challenge.model.js")).default;
          const updatedChallenge = await Challenge.findOneAndUpdate(
              { _id: postId, "submissions.user": userId },
              { $push: { "submissions.$.screenshots": uploaded.secure_url } },
              { new: true }
          );
          if (updatedChallenge) {
              console.log(`✅ Challenge ${postId} updated with screenshot for user ${userId}`);
          } else {
              console.warn(`⚠️ Could not find challenge ${postId} or submission for user ${userId}`);
          }
      } else {
          const Post = (await import("../models/Post.model.js")).default;
          const updatedPost = await Post.findByIdAndUpdate(
              postId,
              { $push: { images: uploaded.secure_url } },
              { new: true }
          );
          if (updatedPost) {
               console.log(`✅ Post ${postId} updated with image URL`);

               // Real-time update via socket
               const io = getIO();
               if (io) {
                   io.emit("post:image-updated", { 
                       postId, 
                       imageUrl: uploaded.secure_url,
                       allImages: updatedPost.images 
                   });
               }
          } else {
              console.warn(`⚠️ Could not find post ${postId} to update image`);
          }
      }

      // Cleanup
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 Cleaned up: ${absolutePath}`);
      }

      await job.updateProgress(100);

      return {
        url: uploaded.secure_url,
        postId
      };

    } catch (error) {
       console.error(`❌ Upload error for job ${job.id}:`, error);
       // Attempt cleanup even on error
       if (fs.existsSync(absolutePath)) {
         try { fs.unlinkSync(absolutePath); } catch {}
       }
       throw error;
    }
  },
  { connection: redis,
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 1000
    }
  }
);

console.log("🚀 Post Image Craftsman Started");

craftsman.on('error', () => {});
