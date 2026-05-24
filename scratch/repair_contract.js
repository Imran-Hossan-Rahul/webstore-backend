import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";
import Transaction from "../models/Transaction.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";

dotenv.config();

const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  const match = val.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
  if (match) return parseFloat(match[2]); // Return max for range
  return parseFloat(val.replace(/[^\d.]/g, "")) || 0;
};

async function repairAllBrokenContracts() {
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

    console.log(`\n🛠️ FOUND ${broken.length} BROKEN CONTRACTS TO REPAIR.`);

    for (const contract of broken) {
      console.log(`\n--- Repairing: ${contract._id} (${contract.title || 'Untitled'}) ---`);
      
      // Fallback for missing title (Required by schema)
      if (!contract.title) {
        contract.title = "Service Agreement: Restored Devlog";
      }

      // Fallback for missing description (Required by schema)
      if (!contract.description) {
        contract.description = "Automated devlog recovery: Terms restored from system defaults.";
      }

      // Fix invalid paymentStatus enum if present
      if (!["unfunded", "partially_funded", "fully_funded"].includes(contract.paymentStatus)) {
        contract.paymentStatus = "unfunded";
      }

      const budget = parseAmount(contract.agreedBudget);
      if (budget <= 0) {
        console.log(`  ⚠️ Skipping: Invalid budget (${contract.agreedBudget})`);
        // Even if skipping funding, we should fix the milestones array to be empty instead of missing?
        // No, let's just skip.
        continue;
      }

      const initialAmount = (budget * 0.2).toFixed(2);
      const balanceAmount = (budget * 0.8).toFixed(2);
      const fundedAmount = parseFloat(initialAmount);

      // 1. Restore Milestones
      contract.milestones = [
        { 
          title: "Devlog Initiation & Security Escrow (20%)", 
          amount: initialAmount, 
          isInitial: true, 
          isAutoFunded: true,
          status: "funded",
          isFunded: true,
          amountFunded: fundedAmount
        },
        { 
          title: "Final Deliverable & Transfer (80%)", 
          amount: balanceAmount, 
          isAutoBalance: true, 
          isAutoFunded: true,
          status: "pending",
          isFunded: false
        }
      ];

      // 2. Adjust Escrow Balance & Payment Status
      contract.escrowBalance = fundedAmount;
      contract.paymentStatus = "partially_funded";

      // 3. Deduct from Patron Wallet
      const patron = await User.findById(contract.patron);
      if (patron && patron.walletBalance >= fundedAmount) {
        patron.walletBalance -= fundedAmount;
        await patron.save();
        console.log(`  ✅ Deducted ${fundedAmount} from patron wallet. New balance: ${patron.walletBalance}`);

        // 4. Create Transactions
        await Transaction.create({
          contract: contract._id,
          fromUser: contract.patron,
          amount: fundedAmount,
          type: "deposit",
          status: "completed",
          paymentGateway: "token_internal",
          gatewayTransactionId: `REPAIR-BATCH-${Date.now()}`,
          metadata: { autoFunded: true, repair: true }
        });

        await TokenTransaction.create({
          user: contract.patron,
          amount: fundedAmount,
          type: "spend",
          source: "contract_escrow",
          description: `Escrow recovery for: ${contract.title}`,
          metadata: { contractId: contract._id }
        });
      } else {
        console.log(`  ⚠️ Patron ${contract.patron} has insufficient balance. Funding as 'unfunded'.`);
        contract.milestones[0].isFunded = false;
        contract.milestones[0].status = "pending";
        contract.escrowBalance = 0;
        contract.paymentStatus = "unfunded";
      }

      await contract.save();
      console.log(`  ✅ Successfully repaired contract ${contract._id}`);
    }

    console.log("\n✅ ALL REPAIRS COMPLETED.");
    process.exit(0);
  } catch (err) {
    console.error("REPAIR ERROR:", err);
    process.exit(1);
  }
}

repairAllBrokenContracts();

