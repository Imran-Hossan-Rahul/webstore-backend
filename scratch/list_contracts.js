import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";

dotenv.config();

async function listAllContracts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const contracts = await Contract.find().sort({ createdAt: -1 }).limit(20);
    console.log(`\n📋 FOUND ${contracts.length} CONTRACTS:`);
    contracts.forEach(c => {
      console.log(`- ID: ${c._id} | Status: ${c.status} | Title: ${c.title}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listAllContracts();
