import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";

dotenv.config();

const giveTokens = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const email = "patron@gmail.com";
    const amount = 10;

    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }

    const previousBalance = user.walletBalance || 0;
    user.walletBalance = previousBalance + amount;
    await user.save();

    await TokenTransaction.create({
      user: user._id,
      amount: amount,
      type: "reward",
      source: "admin_bonus",
      description: "Admin bonus tokens credited",
      metadata: {
        previousBalance,
        newBalance: user.walletBalance
      }
    });

    console.log(`Successfully gave ${amount} tokens to ${email}. New balance: ${user.walletBalance}`);
    process.exit(0);
  } catch (err) {
    console.error("Error giving tokens:", err);
    process.exit(1);
  }
};

giveTokens();
