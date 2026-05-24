import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";

dotenv.config();

const checkBalance = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: "patron@gmail.com" }).select("walletBalance email");
    console.log(JSON.stringify(user, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkBalance();
