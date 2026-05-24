import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";

dotenv.config();

async function inspectContract() {
  const contractId = "6a05c94356cf8e9ce318ae42";
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const contract = await Contract.findById(contractId)
      .populate("patron", "name email walletBalance")
      .populate("craftsman", "name email");

    if (!contract) {
      console.log("❌ Contract not found");
      process.exit(1);
    }

    console.log("\n📄 CONTRACT DETAILS:");
    console.log(`ID: ${contract._id}`);
    console.log(`Title: ${contract.title}`);
    console.log(`Status: ${contract.status}`);
    console.log(`Budget: ${contract.budget} ${contract.currency}`);
    console.log(`Escrow Balance: ${contract.escrowBalance}`);
    console.log(`Patron: ${contract.patron?.name} (${contract.patron?.email}) | Wallet: ${contract.patron?.walletBalance}`);
    console.log(`Craftsman: ${contract.craftsman?.name} (${contract.craftsman?.email})`);

    console.log("\n🛤️ MILESTONES:");
    if (!contract.milestones || contract.milestones.length === 0) {
      console.log("No milestones found in contract object.");
    } else {
      contract.milestones.forEach((m, idx) => {
        console.log(`${idx + 1}. [${m.status}] ${m.title} | Amount: ${m.amount} | Funded: ${m.isFunded}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectContract();
