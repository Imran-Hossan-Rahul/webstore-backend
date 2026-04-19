import { Worker } from "bullmq";
import redis from "../config/redis.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

console.log(`🔧 Chat Media Worker starting from: ${__dirname}`);

connectToDatabase()
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker failed to connect to MongoDB:", err));




const worker = new Worker(
  "chat-media-upload",
  async (job) => {
    console.log(`🛠️ Processing chat media job: ${job.id}`);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const { filePath, discussionId, messageId, mediaType, originalName } = job.data;

    if (!filePath || !discussionId || !messageId) {
      throw new Error("Job data missing");
    }

    let absolutePath = path.isAbsolute(filePath) ? filePath : path.join(backendRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      await job.updateProgress(10);
      
      const Discussion = (await import("../models/Discussion.model.js")).default;
      
      let uploadOptions = {
        folder: "chat_media",
        public_id: `chat_${discussionId}_${messageId}_${Date.now()}`,
      };

      if (mediaType === "image") {
        uploadOptions.resource_type = "image";
        uploadOptions.quality = "auto:good";
        uploadOptions.fetch_format = "auto";
      } else if (mediaType === "video") {
        uploadOptions.resource_type = "video";
        uploadOptions.quality = "auto";
      } else {
        uploadOptions.resource_type = "auto";
        uploadOptions.use_filename = true;
      }

      console.log(`📤 Uploading ${mediaType} to Cloudinary`);

      const uploaded = await cloudinary.uploader.upload(absolutePath, uploadOptions);

      console.log(`☁️ Uploaded: ${uploaded.secure_url}`);
      await job.updateProgress(80);

      const discussion = await Discussion.findById(discussionId);
      if (discussion) {
        const message = discussion.messages.id(messageId);
        if (message) {
          if (!message.attachments) message.attachments = [];
          message.attachments.push({
            type: mediaType,
            url: uploaded.secure_url,
            name: originalName || `${mediaType}_${Date.now()}`,
            size: uploaded.bytes
          });
          await discussion.save();
          console.log(`✅ Discussion ${discussionId} message updated with media`);
        }
      }

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🧹 Cleaned up: ${absolutePath}`);
      }

      await job.updateProgress(100);

      // Emit real-time update
      const { getIO } = await import("../utils/socketManager.js");
      const io = getIO();
      if (io) {
        io.to(`discussion_${discussionId}`).emit("discussion:mediaUploaded", {
          discussionId,
          messageId,
          attachment: {
            type: mediaType,
            url: uploaded.secure_url,
            name: originalName,
            size: uploaded.bytes
          }
        });
      }

      return {
        url: uploaded.secure_url,
        discussionId,
        messageId
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
    concurrency: 15,
    limiter: {
      max: 100,
      duration: 1000
    }
  }
);

console.log("🚀 Chat Media Worker Started");
