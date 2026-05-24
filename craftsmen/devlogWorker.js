import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import cloudinary from "../services/cloudinary.js";
import Artifact from "../models/Artifact.model.js";
import mongoose from "mongoose";

// -----------------------------
// MongoDB Connection (Craftsman)
// -----------------------------

// Redis connection


// Queue events

const craftsman = new Craftsman(
  "scan-queue",
  async (job) => {
    console.log(`🛠️ New job received: ${job.id}`);
    const { artifactId, originalName, fileBuffer } = job.data;

    if (!fileBuffer) throw new Error("File buffer missing");

    // Decode base64 back to buffer
    const buffer = Buffer.from(fileBuffer, "base64");

    // Create temp dir
    const tempDir = path.join("uploads/temp", `job-${job.id}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, originalName);

    try {
      // Write file
      await fs.writeFile(tempFilePath, buffer);
      console.log("💾 File written:", tempFilePath);

      const ext = path.extname(originalName).toLowerCase();
      let extractDir = tempDir;

      if (ext === ".zip") {
        extractDir = path.join(tempDir, "extracted");
        await fs.mkdir(extractDir, { recursive: true });
        try {
          const zip = new AdmZip(tempFilePath);
          zip.extractAllTo(extractDir, true);
          console.log("📦 ZIP extracted:", extractDir);
        } catch (err) {
          console.error("❌ Invalid zip:", err.message);
          await Artifact.findByIdAndUpdate(artifactId, {
            status: "rejected",
          });
          return;
        }
      } else {
        console.log("📁 Not a ZIP, using file directly.");
      }

      // Scan for malicious files
      const files = await fs.readdir(extractDir);
      const forbidden = [".exe", ".bat", ".sh", ".php"];
      const malicious = files.some((file) =>
        forbidden.includes(path.extname(file).toLowerCase())
      );

      if (malicious) {
        await Artifact.findByIdAndUpdate(artifactId, {
          status: "rejected",
        });
        console.log("⛔ Malicious file detected. Artifact rejected.");
        return;
      }

      console.log("🛡️ Security scan passed.");

      // Non-ZIP → create ZIP
      let uploadPath = tempFilePath;
      if (ext !== ".zip") {
        const zipName = `${path.basename(originalName, ext)}-${Date.now()}.zip`;
        const zipPath = path.join(tempDir, zipName);
        const zip = new AdmZip();
        zip.addLocalFolder(extractDir);
        zip.writeZip(zipPath);
        uploadPath = zipPath;
        console.log("🗜️ Folder zipped:", uploadPath);
      }

      // 1. Upload to Cloudinary with access_mode: "public"
      const uploaded = await cloudinary.uploader.upload(uploadPath, {
        folder: "devlog_files",
        resource_type: "raw",
        access_mode: "public", // এটিই ফাইলটিকে পাবলিক করার জন্য যথেষ্ট হওয়া উচিত
      });
      console.log("☁️ Uploaded to Cloudinary:", uploaded.secure_url);

      // 2. 🔥 FIX: Removed the non-existent cloudinary.uploader.update call.
      // If the file is still 'Blocked for delivery', the issue is a global Cloudinary account setting.

      // Update artifact
      await Artifact.findByIdAndUpdate(artifactId, {
        devlogFile: uploaded.secure_url,
        fileSize: uploaded.bytes,
        status: "ready",
      });
      console.log("🟢 Artifact updated to READY.");
    } catch (err) {
      console.error("❌ Craftsman processing error:", err);
      // এই ত্রুটিটি এখন প্রথম ধাপের আপলোড বা অন্য কোনো সমস্যার জন্য হতে পারে।
      // যেমন, যদি access_mode: "public" ব্লক করা থাকে।
      await Artifact.findByIdAndUpdate(artifactId, { status: "error" });
      throw err;
    } finally {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        console.log("🧹 Temp cleaned:", tempDir);
      }
    }
  },
  { connection: redis, concurrency: 3 }
);

craftsman.on("completed", (job) =>
  console.log(`✅ Craftsman finished job ${job.id}`)
);
craftsman.on("failed", (job, err) =>
  console.error(`❌ Craftsman job ${job.id} failed:`, err.message)
);

console.log("🚀 Devlog Craftsman Started (Fixed Version)");


