import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "../models/Codex.model.js";

dotenv.config();

// Replace all dash variants with clean alternatives
function removeDashes(text) {
  if (!text) return text;
  return text
    // em dash with spaces around it -> just a period or comma depending on context
    .replace(/ — /g, " ")
    // em dash without spaces
    .replace(/—/g, " ")
    // en dash with spaces
    .replace(/ – /g, " ")
    // en dash without spaces
    .replace(/–/g, " ");
}

async function fixAllCodex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const all = await Codex.find({ isDeleted: false });
    console.log(`Found ${all.length} codex articles to check.`);

    let updated = 0;

    for (const codex of all) {
      const fixedContent = removeDashes(codex.content);
      const fixedTitle = removeDashes(codex.title);
      const fixedSubtitle = removeDashes(codex.subtitle);
      const fixedExcerpt = removeDashes(codex.excerpt);

      const changed =
        fixedContent !== codex.content ||
        fixedTitle !== codex.title ||
        fixedSubtitle !== codex.subtitle ||
        fixedExcerpt !== codex.excerpt;

      if (changed) {
        codex.content = fixedContent;
        codex.title = fixedTitle;
        codex.subtitle = fixedSubtitle;
        codex.excerpt = fixedExcerpt;
        await codex.save();
        console.log(`✅ Fixed: "${codex.title}"`);
        updated++;
      }
    }

    console.log(`\nDone. Updated ${updated} articles.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

fixAllCodex();
