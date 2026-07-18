import mongoose from "mongoose";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Codex from "../models/Codex.model.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const authorId = "69eca62e6cc47b43588142c5";

async function publish() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const articles = JSON.parse(
      readFileSync(join(__dirname, "codex_route_callback_error.json"), "utf8")
    );

    for (const article of articles) {
      const exists = await Codex.exists({ title: article.title });
      if (exists) {
        console.log(`⚠️  Already exists: "${article.title}"`);
        continue;
      }

      const codex = new Codex({
        ...article,
        author: authorId,
        isPublished: true,
        isDeleted: false,
      });

      await codex.save();
      console.log(`🎉 Published: "${codex.title}"`);
      console.log(`🔗 Slug: "${codex.slug}"`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

publish();
