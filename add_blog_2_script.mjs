import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import { marked } from "marked";
import Codex from "./models/Codex.model.js";
import User from "./models/User.model.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const filePath = "C:\\Users\\Imran hossan\\Downloads\\blog_02_nextjs14_cookies_empty_server_actions.md";
    let content = fs.readFileSync(filePath, "utf8");

    // Clean up markdown
    // 1. Remove dashed lines
    content = content.replace(/^[-_]{2,}\s*$/gm, '');
    
    // 2. Remove emojis
    const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;
    content = content.replace(emojiRegex, '');
    
    // 3. Remove metadata lines like "Published: ..."
    content = content.replace(/^\*\*Published:\*\*.*$/gm, '');
    
    // 4. Remove extra newlines
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    // Extract title from the first H1
    const match = content.match(/^#\s+(.+)$/m);
    let title = match ? match[1] : "Next.js 14 Server Actions Cookies Issue";

    // Parse to HTML
    const htmlContent = marked.parse(content);

    // Get an author (admin)
    const admin = await User.findOne({ $or: [{ isSuperAdmin: true }, { role: "admin" }] });
    if (!admin) {
      console.log("No admin found.");
      process.exit(1);
    }

    const codex = new Codex({
      title: title,
      content: htmlContent,
      author: admin._id,
      isPublished: true,
      category: "nextjs",
      tags: ["nextjs", "react", "server-actions", "cookies"],
      readTime: "10 min read"
    });

    await codex.save();
    console.log("Blog 2 successfully added as Codex with slug:", codex.slug);
    process.exit(0);
  } catch (e) {
    console.error("Error adding codex:", e);
    process.exit(1);
  }
}

run();
