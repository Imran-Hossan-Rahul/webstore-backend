import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "../models/Codex.model.js";

dotenv.config();

const uri = process.env.MONGODB_URI;

async function checkDB() {
  try {
    await mongoose.connect(uri);
    console.log("✅ DB Connected!");
    const count = await Codex.countDocuments({});
    console.log(`Total Codex articles in DB: ${count}`);
    const codexes = await Codex.find({}, 'title slug category').sort({ createdAt: 1 });
    codexes.forEach((c, idx) => {
      console.log(`[${idx + 1}] Title: "${c.title}" \n    Slug: "${c.slug}"`);
    });
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkDB();
