import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "../models/Codex.model.js";

dotenv.config();

async function wipeAllCodex() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected!");

    const count = await Codex.countDocuments({});
    console.log(`Found ${count} codex documents.`);

    if (count === 0) {
      console.log("Nothing to delete.");
      process.exit(0);
    }

    const result = await Codex.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} codex documents successfully.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

wipeAllCodex();
