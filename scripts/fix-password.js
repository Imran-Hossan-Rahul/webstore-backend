/**
 * Quick fix: directly update the creator password bypassing Mongoose hooks.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const CREATOR_EMAIL = "imranhossanrahul.dev@gmail.com";
const CORRECT_PASSWORD = "12!@imraN";

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected.");

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(CORRECT_PASSWORD, salt);

  // Update directly via collection to bypass pre-save hook (no double hashing)
  const result = await mongoose.connection
    .collection("users")
    .updateOne(
      { email: CREATOR_EMAIL },
      { $set: { password: hash } }
    );

  if (result.matchedCount === 0) {
    console.log("❌ User not found:", CREATOR_EMAIL);
  } else {
    console.log("✅ Password updated successfully for:", CREATOR_EMAIL);
    console.log("   Password:", CORRECT_PASSWORD);
  }

  await mongoose.disconnect();
  console.log("🔌 Done.");
}

run().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
