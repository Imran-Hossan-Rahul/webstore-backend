import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "./models/Codex.model.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const slugsToUpdate = [
      "react-18-vite-5-swc-cannot-read-properties-of-null-in-strict-mode-the-real-fix",
      "nextjs-14-app-router-why-cookies-returns-empty-in-server-actions-and-3-ways-to-fix-it"
    ];

    for (const slug of slugsToUpdate) {
      const codex = await Codex.findOne({ slug });
      if (!codex) {
        console.log(`Codex not found: ${slug}`);
        continue;
      }

      let content = codex.content;

      // The markdown parsed by marked usually looks like:
      // <h2 id="...">Table of Contents</h2>
      // <ol>
      // ...
      // </ol>
      // or <ul> ... </ul>
      
      // Regular expression to find "Table of Contents" heading and the following list
      const tocRegex = /<h2[^>]*>Table of Contents<\/h2>\s*<(ol|ul)>[\s\S]*?<\/\1>/i;

      if (tocRegex.test(content)) {
        content = content.replace(tocRegex, '<div data-type="toc"></div>');
        codex.content = content;
        await codex.save();
        console.log(`Successfully updated TOC for: ${slug}`);
      } else {
        console.log(`TOC pattern not found in: ${slug}`);
        // Let's print a small preview of the content to debug if it fails
        console.log(content.substring(0, 300));
      }
    }

    process.exit(0);
  } catch (e) {
    console.error("Error updating codexes:", e);
    process.exit(1);
  }
}

run();
