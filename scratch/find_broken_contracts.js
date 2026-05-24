import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";

dotenv.config();

async function findBrokenContracts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const broken = await Contract.find({
      status: "active",
      $or: [
        { milestones: { $size: 0 } },
        { milestones: { $exists: false } }
      ]
    });

    console.log(`\n🔍 FOUND ${broken.length} BROKEN ACTIVE CONTRACTS:`);
    broken.forEach(c => {
      console.log(`- ID: ${c._id} | Title: ${c.title} | Budget: ${c.agreedBudget}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findBrokenContracts();
