import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

console.log(`🔧 Quick Post Media Craftsman starting from: ${__dirname}`);

connectToDatabase()
  .then(() => console.log("✅ Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Craftsman failed to connect to MongoDB:", err));




const craftsman = new Craftsman(
  "quick-post-media",
  async (job) => {
    console.log(`🛠️ Processing quick post media job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const { filePath, postId, mediaType, originalName } = job.data;

    if (!filePath || !postId) {
      throw new Error("Job data missing");
    }

    let absolutePath = path.isAbsolute(filePath) ? filePath : path.join(backendRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      await job.updateProgress(10);
      
      const Post = (await import("../models/Post.model.js")).default;
      
      let uploadOptions = {
        folder: "quick_posts",
        public_id: `post_${postId}_${Date.now()}`,
      };

      if (mediaType === "image") {
        uploadOptions.resource_type = "image";
        uploadOptions.quality = "auto:good";
        uploadOptions.fetch_format = "auto";
        uploadOptions.transformation = [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto:good" }
        ];
      } else if (mediaType === "video") {
        uploadOptions.resource_type = "video";
        uploadOptions.quality = "auto";
        uploadOptions.transformation = [
          { width: 1280, height: 720, crop: "limit" }
        ];
      } else {
        uploadOptions.resource_type = "auto";
        uploadOptions.use_filename = true;
      }

      console.log(`📤 Uploading ${mediaType} to Cloudinary`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, uploadOptions);

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      const post = await Post.findById(postId);
      if (post) {
        if (!post.media) post.media = [];
        post.media.push({
          type: mediaType,
          url: uploaded.secure_url,
          name: originalName || `${mediaType}_${Date.now()}`,
          size: uploaded.bytes,
          width: uploaded.width,
          height: uploaded.height
        });
        await post.save();
        console.log(`✅ Post ${postId} updated with media`);
      }

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 Cleaned up: ${absolutePath}`);
      }

      await job.updateProgress(100);

      // Emit real-time update via socket
      const { getIO } = await import("../utils/socketManager.js");
      const io = getIO();
      if (io) {
        io.emit("post:mediaUploaded", {
          postId,
          media: {
            type: mediaType,
            url: uploaded.secure_url,
            name: originalName,
            size: uploaded.bytes
          }
        });
      }

      return {
        url: uploaded.secure_url,
        postId
      };

    } catch (error) {
       console.error(`❌ Upload error for job ${job.id}:`, error);
       if (fs.existsSync(absolutePath)) {
         try { fs.unlinkSync(absolutePath); } catch {}
       }
       throw error;
    }
  },
  { connection: redis,
    concurrency: 20,
    limiter: {
      max: 150,
      duration: 1000
    },
    settings: {
      backoffStrategy: (attemptsMade) => {
        return Math.min(Math.pow(2, attemptsMade) * 1000, 30000);
      }
    }
  }
);

craftsman.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

craftsman.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

console.log("🚀 Quick Post Media Craftsman Started with high concurrency");
