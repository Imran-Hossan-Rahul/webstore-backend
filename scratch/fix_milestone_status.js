import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";

dotenv.config();

const fixMilestones = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find contracts that have some escrow balance
    const contracts = await Contract.find({ escrowBalance: { $gt: 0 } });
    
    for (const contract of contracts) {
      let changed = false;
      // If the contract is active/pending and has balance, 
      // assume the first milestone (or relevant ones) should be marked as funded
      // In this specific case, the user likely funded the first milestone(s)
      
      contract.milestones.forEach(m => {
        if (m.amount <= contract.escrowBalance && m.status === "pending") {
          console.log(`Updating milestone "${m.title}" in contract ${contract._id} to funded`);
          m.isFunded = true;
          m.amountFunded = m.amount;
          m.status = "funded";
          changed = true;
        }
      });

      if (changed) {
        await contract.save();
      }
    }

    console.log("Milestone statuses fixed.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixMilestones();
