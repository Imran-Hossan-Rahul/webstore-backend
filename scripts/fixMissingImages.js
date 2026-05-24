import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Artifact from "../models/Artifact.model.js";
import Post from "../models/Post.model.js";
import Codex from "../models/Codex.model.js";
import Challenge from "../models/Challenge.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const placeholders = [
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1555949963-aa79dcee57d5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
];

const getRandomImage = () => placeholders[Math.floor(Math.random() * placeholders.length)];

const fixImages = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for image fixing...");

    // 1. Artifacts (previewFile)
    const artRes = await Artifact.updateMany(
      { $or: [{ previewFile: { $exists: false } }, { previewFile: null }, { previewFile: "" }] },
      { $set: { previewFile: getRandomImage() } }
    );
    console.log(`Updated ${artRes.modifiedCount} Artifacts with missing images.`);

    // 2. Devlogs / Posts (images array)
    const postRes = await Post.updateMany(
      { $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] },
      { $set: { images: [getRandomImage()] } }
    );
    console.log(`Updated ${postRes.modifiedCount} Posts/Devlogs with missing images.`);

    // 3. Codex (coverImage)
    const codexRes = await Codex.updateMany(
      { $or: [{ coverImage: { $exists: false } }, { coverImage: null }, { coverImage: "" }] },
      { $set: { coverImage: getRandomImage() } }
    );
    console.log(`Updated ${codexRes.modifiedCount} Codexes with missing images.`);

    // 4. Challenge (coverImage)
    const chalRes = await Challenge.updateMany(
      { $or: [{ coverImage: { $exists: false } }, { coverImage: null }, { coverImage: "" }] },
      { $set: { coverImage: getRandomImage() } }
    );
    console.log(`Updated ${chalRes.modifiedCount} Challenges with missing images.`);

    console.log("Missing image fix complete!");
    process.exit(0);

  } catch (error) {
    console.error("Error fixing images:", error);
    process.exit(1);
  }
};

fixImages();
