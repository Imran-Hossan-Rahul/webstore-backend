/**
 * Reset login attempts and unlock account.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.collection("users").updateOne(
    { email: "imranhossanrahul.dev@gmail.com" },
    { $set: { loginAttempts: 0, lockUntil: null, isActive: true, emailVerified: true } }
  );
  const u = await mongoose.connection.collection("users").findOne({ email: "imranhossanrahul.dev@gmail.com" });
  console.log("Updated:", result.modifiedCount, "| loginAttempts:", u.loginAttempts, "| lockUntil:", u.lockUntil, "| isActive:", u.isActive);
  await mongoose.disconnect();
}

run().catch(console.error);
