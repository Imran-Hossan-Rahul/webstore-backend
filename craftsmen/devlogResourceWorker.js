import { Worker as Craftsman } from "bullmq";
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

console.log(`🔧 Devlog Resource Craftsman starting from: ${__dirname}`);

// Connect to Database
connectToDatabase()
  .then(() => console.log("✅ Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Craftsman failed to connect to MongoDB:", err));

// Redis connection


// Queue events

// Craftsman
const craftsman = new Craftsman(
  "devlog-resource-upload",
  async (job) => {
    console.log(`🛠️ Processing devlog resource job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { filePath, postId, userId, originalName, targetType = "Post" } = job.data;

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
      
      // Security Scan if it's a zip
      if (path.extname(absolutePath).toLowerCase() === '.zip') {
          console.log("🔍 Scanning ZIP for dangerous content...");
          const { scanZipFile } = await import("../utils/fileValidator.js");
          const scanResult = scanZipFile(absolutePath);
          if (!scanResult.valid) {
              throw new Error(`Security violation detected: ${scanResult.errors.join(', ')}`);
          }
      }

      // Upload to Cloudinary (resource_type: "raw" or "auto")
      console.log(`📤 Uploading to Cloudinary: devlog_resources`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, {
        folder: targetType === "Challenge" ? "challenge_submissions" : "devlog_resources",
        public_id: `resource_${postId}_${Date.now()}`,
        resource_type: "auto",
        use_filename: true,
        overwrite: false
      });

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      // Create Resource Object
      const resourceObj = {
          title: originalName || (targetType === "Challenge" ? "Source Code" : "Devlog Resource"),
          url: uploaded.secure_url,
          type: "file"
      };

      if (targetType === "Challenge_Craftsman_Resource") {
          const Challenge = (await import("../models/Challenge.model.js")).default;
          // Find the challenge and update the resource URL that matches the original name or a placeholder
          // For craftsman resources, we usually push to the main resources array.
          // The resourceObj contains the Cloudinary URL.
          
          // We assume the resource object was already in the array with a placeholder URL
          // Or we can just push it if it's new. 
          // Based on the controller logic, it's usually already there.
          
          // Let's use a more robust way: find by placeholder or name
          const updatedChallenge = await Challenge.findOneAndUpdate(
              { _id: postId, "resources.name": originalName },
              { $set: { "resources.$.url": uploaded.secure_url } },
              { new: true }
          );
          
          if (updatedChallenge) {
              console.log(`✅ Challenge ${postId} craftsman resource updated: ${originalName}`);
          } else {
              // Fallback: Just push it if not found (though it should be there)
              await Challenge.findByIdAndUpdate(postId, {
                  $push: { resources: resourceObj }
              });
              console.log(`✅ Challenge ${postId} craftsman resource pushed (fallback): ${originalName}`);
          }
      } else if (targetType === "Challenge") {
          const Challenge = (await import("../models/Challenge.model.js")).default;
          // 🚀 ATOMIC UPDATE: Add resource to specific user's submission
          const result = await Challenge.findOneAndUpdate(
            { _id: postId, "submissions.user": userId },
            { $push: { "submissions.$.resources": resourceObj } },
            { new: true }
          );
          
          if (result) {
            console.log(`✅ Submission updated with resource for user: ${userId}`);
          } else {
            console.warn(`⚠️ Submission not found for user: ${userId}`);
          }
      } else {
          const Post = (await import("../models/Post.model.js")).default;
          // 🚀 ATOMIC UPDATE: Add resource to post
          const result = await Post.findByIdAndUpdate(
            postId,
            { $push: { "devlogStats.resources": resourceObj } },
            { new: true }
          );
          if (result) {
              console.log(`✅ Post ${postId} updated with resource URL`);
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
    concurrency: 5, // Slightly lower concurrency for larger files
    limiter: {
      max: 20,
      duration: 1000
    }
  }
);

console.log("🚀 Devlog Resource Craftsman Started");

