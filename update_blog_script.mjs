import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import { marked } from "marked";
import Codex from "./models/Codex.model.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const content = fs.readFileSync("c:\\Codalina\\codex to add\\blog_01_editor_ready.md", "utf8");
    
    // Parse markdown to HTML
    const htmlContent = marked.parse(content);

    const updated = await Codex.findOneAndUpdate(
      { slug: "react-18-vite-5-swc-cannot-read-properties-of-null-in-strict-mode-the-real-fix" },
      { $set: { content: htmlContent } },
      { new: true }
    );

    if (updated) {
      console.log("Codex successfully updated with HTML content.");
    } else {
      console.log("Codex not found!");
    }
    process.exit(0);
  } catch (e) {
    console.error("Error updating codex:", e);
    process.exit(1);
  }
}

run();
