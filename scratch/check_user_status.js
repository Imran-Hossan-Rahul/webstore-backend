
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";

dotenv.config();

const checkStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = "patron@gmail.com";
    const user = await User.findOne({ email });
    console.log(`User: ${user.email}`);
    console.log(`isHost: ${user.isHost}`);
    console.log(`isVerified: ${user.isVerified}`);
    console.log(`verificationStatus: ${user.verificationStatus}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkStatus();
