import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "./models/Codex.model.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const codexes = await Codex.find({});
    let updatedCount = 0;

    for (const codex of codexes) {
      if (!codex.content) continue;

      let content = codex.content;
      
      // Try to find an h1 tag.
      // We will match <h1 ...>...</h1>
      const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
      const match = content.match(h1Regex);
      
      if (match) {
        // We will remove the h1 if its text content loosely matches the title
        // Or we just remove the first H1 if it's the very first thing
        const h1Text = match[1].replace(/<[^>]+>/g, '').trim();
        const codexTitle = codex.title.trim();
        
        // Remove it if the text matches the title (ignoring case), or if it's identical
        if (h1Text.toLowerCase() === codexTitle.toLowerCase() || codexTitle.includes(h1Text) || h1Text.includes(codexTitle)) {
          content = content.replace(h1Regex, '').trim();
          codex.content = content;
          await codex.save();
          updatedCount++;
          console.log(`Removed duplicate H1 title from codex: ${codex.slug}`);
        } else {
            // Also if there's any h1 tag, it might be the title. Let's just remove the first h1 if it's extremely similar.
            console.log(`Found H1 in ${codex.slug} but it didn't match title exactly. H1: "${h1Text}", Title: "${codexTitle}"`);
            // Actually, if it's the only h1, let's remove it because articles shouldn't have h1 inside the body.
            content = content.replace(h1Regex, '').trim();
            codex.content = content;
            await codex.save();
            updatedCount++;
            console.log(`Removed H1 from codex: ${codex.slug}`);
        }
      }
    }

    console.log(`Finished. Updated ${updatedCount} codexes.`);
    process.exit(0);
  } catch (e) {
    console.error("Error updating codexes:", e);
    process.exit(1);
  }
}

run();
