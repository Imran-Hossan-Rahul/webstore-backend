
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";

dotenv.config();

const makeHost = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const email = "patron@gmail.com";
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      process.exit(1);
    }

    user.isHost = true;
    // Also ensuring they are verified to look like a professional host
    user.isVerified = true;
    user.verificationStatus = "approved";
    
    await user.save();

    console.log(`Successfully made ${email} a Challenge Host!`);
    console.log(`isHost: ${user.isHost}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error making user host:", error);
    process.exit(1);
  }
};

makeHost();
