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

console.log(`🔧 Project Resource Worker starting from: ${__dirname}`);

// Connect to Database
connectToDatabase()
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker failed to connect to MongoDB:", err));

// Redis connection


// Queue events

// Worker
const worker = new Worker(
  "project-resource-upload",
  async (job) => {
    console.log(`🛠️ Processing project resource job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { filePath, postId, userId, originalName } = job.data;

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
      
      // Upload to Cloudinary (resource_type: "raw" or "auto")
      console.log(`📤 Uploading to Cloudinary: project_resources`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, {
        folder: "project_resources",
        public_id: `resource_${postId}_${Date.now()}`,
        resource_type: "auto", // Let Cloudinary detect (zip, pdf, etc.)
        use_filename: true,
        overwrite: false
      });

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      // Create Resource Object
      const resourceObj = {
          title: originalName || "Project Resource",
          url: uploaded.secure_url,
          type: "file" // or 'archive', 'pdf' etc.
      };

      // Update Post Model
      const post = await Post.findById(postId);
      if (post) {
          // Initialize array if missing
          if (!post.projectStats.resources) {
              post.projectStats.resources = [];
          }
          
          post.projectStats.resources.push(resourceObj);
          await post.save();
          console.log(`✅ Post ${postId} updated with resource URL`);
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
    concurrency: 5, // Slightly lower concurrency for larger files
    limiter: {
      max: 20,
      duration: 1000
    }
  }
);

console.log("🚀 Project Resource Worker Started");
