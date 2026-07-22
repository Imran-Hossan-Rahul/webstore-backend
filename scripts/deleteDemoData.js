import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Artifact from "../models/Artifact.model.js";
import Post from "../models/Post.model.js";
import Comment from "../models/Comment.model.js";
import Notification from "../models/Notification.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const deleteDemoData = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // Find all demo artifacts (we seeded them with high views/downloads)
    // Or just all artifacts with "Gen" in the title or the 5 original ones.
    const demoTitles = [
      "Nexus React Admin Dashboard",
      "Aura E-Commerce UI Kit",
      "Fluid Animations Library",
      "Cryptic Crypto Wallet UI",
      "Nova SaaS Landing Page",
      "Quantum Authentication Components"
    ];

    console.log("Deleting demo Artifacts...");
    const artifactRes = await Artifact.deleteMany({
      $or: [
        { title: { $in: demoTitles } },
        { title: { $regex: /Gen \d+/ } }
      ]
    });
    console.log(`Deleted ${artifactRes.deletedCount} Artifacts.`);

    console.log("Deleting demo Devlogs (Posts)...");
    const devlogRes = await Post.deleteMany({
      postType: "devlog",
      $or: [
        { title: { $regex: /Building the Future/ } },
        { title: { $regex: /Architecture Decisions/ } },
        { title: { $regex: /Performance Optimization/ } },
        { title: { $regex: /State Management/ } },
        { title: { $regex: /Designing the UI/ } },
        { title: { $regex: /Gen \d+/ } }
      ]
    });
    console.log(`Deleted ${devlogRes.deletedCount} Devlogs.`);

    console.log("Cleaning up orphaned comments...");
    // Since we deleted artifacts and devlogs, any comments pointing to them are now orphaned.
    // It's easiest to just delete all comments created in the last 2 hours.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const commentRes = await Comment.deleteMany({
      createdAt: { $gte: twoHoursAgo }
    });
    console.log(`Deleted ${commentRes.deletedCount} Comments.`);
    
    // Also delete notifications generated in the last 2 hours to avoid dead links
    const notifRes = await Notification.deleteMany({
      createdAt: { $gte: twoHoursAgo }
    });
    console.log(`Deleted ${notifRes.deletedCount} Notifications.`);

    console.log("Demo data cleanup complete!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

deleteDemoData();
