import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";

dotenv.config();

const fixBalance = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find contracts where escrowBalance is slightly less than agreedBudget due to the old fee logic
    const contracts = await Contract.find({ status: "active" });
    
    for (const contract of contracts) {
      if (contract.escrowBalance < contract.agreedBudget && contract.escrowBalance > 0) {
        console.log(`Fixing contract ${contract._id}: ${contract.escrowBalance} -> ${contract.agreedBudget}`);
        contract.escrowBalance = contract.agreedBudget;
        await contract.save();
      }
    }

    console.log("Existing contracts fixed.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixBalance();
