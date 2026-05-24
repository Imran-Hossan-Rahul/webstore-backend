import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import Codex from "../models/Codex.model.js";

dotenv.config();

const uri = process.env.MONGODB_URI;
const authorId = "69eca62e6cc47b43588142c5";

async function publishAll() {
  try {
    console.log("Connecting to Database...");
    if (!uri) {
      throw new Error("MONGODB_URI is not set in environment variables!");
    }
    await mongoose.connect(uri);
    console.log("✅ Database Connected!");

    // Read clean topics from topics.json
    const topics = JSON.parse(fs.readFileSync("scratch/topics.json", "utf8"));
    console.log(`Loaded ${topics.length} topics from topics.json`);

    for (const t of topics) {
      console.log(`\nProcessing Topic: "${t.title}"`);
      
      // Check if it already exists by title
      const exists = await Codex.exists({ title: t.title });
      if (exists) {
        console.log(`⚠️ Skip: Already exists in database!`);
        continue;
      }

      // Create new Codex document
      const codex = new Codex({
        title: t.title,
        subtitle: t.subtitle,
        tags: t.tags,
        category: t.category,
        readTime: t.readTime,
        content: t.content,
        author: authorId,
        isPublished: true,
        isDeleted: false
      });

      // Save document (pre-save middleware generates slug & excerpt automatically)
      await codex.save();
      console.log(`🎉 Successfully published: "${t.title}"`);
      console.log(`🔗 Slug generated: "${codex.slug}"`);
    }

    console.log("\n✅ All topics in Phase 1.3 successfully published!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal publish error:", err);
    process.exit(1);
  }
}

publishAll();
