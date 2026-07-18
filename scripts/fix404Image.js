import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const oldUrlRegex = /photo-1555949963-aa79dcee57d5/i;
const newUrl = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80";

import User from "../models/User.model.js";
import Artifact from "../models/Artifact.model.js";
import Post from "../models/Post.model.js";
import CraftsmanProfile from "../models/CraftsmanProfile.model.js";

async function fixImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Using updateMany to bypass mongoose document validation rules which might fail on old data
    const r1 = await Artifact.updateMany(
      { previewFile: { $regex: oldUrlRegex } },
      { $set: { previewFile: newUrl } }
    );
    console.log("Artifacts updated:", r1.modifiedCount);

    const r2 = await User.updateMany(
      { profilePicture: { $regex: oldUrlRegex } },
      { $set: { profilePicture: newUrl } }
    );
    console.log("User profiles updated:", r2.modifiedCount);

    const r3 = await User.updateMany(
      { coverPicture: { $regex: oldUrlRegex } },
      { $set: { coverPicture: newUrl } }
    );
    console.log("User covers updated:", r3.modifiedCount);

    const r4 = await Post.updateMany(
      { thumbnail: { $regex: oldUrlRegex } },
      { $set: { thumbnail: newUrl } }
    );
    console.log("Post thumbnails updated:", r4.modifiedCount);

    const r5 = await CraftsmanProfile.updateMany(
      { profilePicture: { $regex: oldUrlRegex } },
      { $set: { profilePicture: newUrl } }
    );
    console.log("Craftsman profiles updated:", r5.modifiedCount);

    const r6 = await CraftsmanProfile.updateMany(
      { coverPicture: { $regex: oldUrlRegex } },
      { $set: { coverPicture: newUrl } }
    );
    console.log("Craftsman covers updated:", r6.modifiedCount);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixImages();
