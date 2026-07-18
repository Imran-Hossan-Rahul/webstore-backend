import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Codex from "./models/Codex.model.js";
import User from "./models/User.model.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const content = fs.readFileSync("c:\\Codalina\\codex to add\\blog_01_editor_ready.md", "utf8");

    // Get an author (admin)
    const admin = await User.findOne({ $or: [{ isSuperAdmin: true }, { role: "admin" }] });
    if (!admin) {
      console.log("No admin found. Creating a codex without checking author if possible or failing.");
      process.exit(1);
    }

    const codex = new Codex({
      title: "React 18 + Vite 5 + SWC: 'Cannot read properties of null' in Strict Mode — The Real Fix",
      content: content,
      author: admin._id,
      isPublished: true,
      category: "react",
      tags: ["react", "vite", "swc", "frontend"],
      readTime: "12 min read"
    });

    await codex.save();
    console.log("Codex added successfully with slug:", codex.slug);
    process.exit(0);
  } catch (e) {
    console.error("Error adding codex:", e);
    process.exit(1);
  }
}

run();
