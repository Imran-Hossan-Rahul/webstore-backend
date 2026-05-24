import mongoose from "mongoose";
import Codex from "../models/Codex.model.js";
import dotenv from "dotenv";

dotenv.config();

async function checkCardShapes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const codex = await Codex.find({}).select('title slug cardShape').lean();
    
    console.log(`📊 Total codex: ${codex.length}\n`);
    console.log("Current cardShape values in database:");
    console.log("=====================================");
    
    codex.forEach((codex, index) => {
      console.log(`${index + 1}. "${codex.title}"`);
      console.log(`   Slug: ${codex.slug}`);
      console.log(`   CardShape: ${codex.cardShape || 'NOT SET'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkCardShapes();


