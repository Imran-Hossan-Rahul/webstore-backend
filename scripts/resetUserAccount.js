/**
 * Quick script to check and reset user account state
 * Usage: node scripts/resetUserAccount.js <email>
 */
import mongoose from "mongoose";
import User from "../models/User.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/resetUserAccount.js <email>");
  process.exit(1);
}

await mongoose.connect(MONGODB_CONNECTION_STRING);
console.log("✅ MongoDB connected");

const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

if (!user) {
  console.log("❌ User not found with email:", email);
  process.exit(1);
}

console.log("\n📋 Current user state:");
console.log("  _id         :", user._id);
console.log("  name        :", user.name);
console.log("  email       :", user.email);
console.log("  isActive    :", user.isActive);
console.log("  loginAttempts:", user.loginAttempts);
console.log("  lockUntil   :", user.lockUntil);
console.log("  hasPassword :", !!user.password);

// Reset account
user.isActive = true;
user.loginAttempts = 0;
user.lockUntil = undefined;
await user.save();

console.log("\n✅ Account reset successfully! isActive=true, lockUntil=cleared, loginAttempts=0");
await mongoose.disconnect();
