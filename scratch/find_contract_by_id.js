import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";

dotenv.config();

async function findContract() {
  const contractId = "6a05c94356cf8e9ce318ae47";
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const contract = await Contract.findById(contractId);
    if (contract) {
      console.log("✅ Found exact match!");
      console.log(contract);
    } else {
      console.log("❌ No exact match found.");
      // Search by partial ID
      const partial = await Contract.find({ _id: { $regex: "^6a05c943" } });
      console.log(`\n🔍 FOUND ${partial.length} PARTIAL MATCHES (starting with 6a05c943):`);
      partial.forEach(c => console.log(`- ${c._id} | Title: ${c.title}`));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findContract();
