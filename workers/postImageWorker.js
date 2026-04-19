import { Worker } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

console.log(`🔧 Image Worker starting from: ${__dirname}`);

// Connect to Database
connectToDatabase()
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker failed to connect to MongoDB:", err));

// Redis connection


// Queue events

// Worker
const worker = new Worker(
  "post-image-upload",
  async (job) => {
    console.log(`🛠️ Processing post image job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { filePath, postId, userId } = job.data;

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
      
      const Post = (await import("../models/Post.model.js")).default;
      
      // Upload to Cloudinary
      console.log(`📤 Uploading to Cloudinary: post_images`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, {
        folder: "post_images",
        public_id: `post_${postId}_${Date.now()}`,
        resource_type: "image",
        quality: "auto:good",
        fetch_format: "auto"
      });

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      // Update Post Model
      const post = await Post.findById(postId);
      if (post) {
          post.images.push(uploaded.secure_url);
          // If you have a 'processing' flag, you would clear it here
          await post.save();
          console.log(`✅ Post ${postId} updated with image URL`);
      } else {
          console.error(`❌ Post ${postId} not found`);
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

console.log("🚀 Post Image Worker Started");
