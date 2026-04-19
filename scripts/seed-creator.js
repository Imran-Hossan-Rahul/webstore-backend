/**
 * SEED SCRIPT — Wipe all users & create the single creator account.
 * Usage: node scripts/seed-creator.js
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const CREATOR_EMAIL = "imranhossanrahul.dev@gmail.com";
const CREATOR_PASSWORD = "12!@imraN";
const CREATOR_NAME = "Imran Hossan";
const CREATOR_DISPLAY_NAME = "Imran Hossan";

// ── Inline schemas (avoid side-effects from full model imports) ───────────────
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: { type: String, select: false },
    role: { type: String, default: "user" },
    hasCreatorAccount: { type: Boolean, default: false },
    creatorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile" },
    skills: [String],
    interests: [String],
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
    hasCompletedOnboarding: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const creatorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    displayName: { type: String, required: true },
    bio: { type: String, default: "" },
    skills: [String],
    profilePicture: { type: String, default: "" },
    coverPicture: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected.");

  // Use dynamic model registration to avoid OverwriteModelError
  const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
  const CreatorProfile = mongoose.models.CreatorProfile || mongoose.model("CreatorProfile", creatorSchema, "creatorprofiles");

  // ── 1. Wipe everything ─────────────────────────────────────────────────────
  console.log("🗑️  Deleting all existing users and creator profiles...");
  await User.deleteMany({});
  await CreatorProfile.deleteMany({});
  console.log("✅ All users and creator profiles deleted.");

  // ── 2. Create hashed password ──────────────────────────────────────────────
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(CREATOR_PASSWORD, salt);

  // ── 3. Create the creator user ─────────────────────────────────────────────
  const user = await User.create({
    name: CREATOR_NAME,
    email: CREATOR_EMAIL,
    password: hashedPassword,
    role: "user",
    hasCreatorAccount: true,
    emailVerified: true,
    hasCompletedOnboarding: true,
    isActive: true,
  });

  // ── 4. Create the linked creator profile ──────────────────────────────────
  const creatorProfile = await CreatorProfile.create({
    userId: user._id,
    displayName: CREATOR_DISPLAY_NAME,
    bio: "Platform Creator & Developer",
    skills: ["Writing", "Development", "Design"],
    isVerified: true,
  });

  // ── 5. Link creator profile back to user ──────────────────────────────────
  await User.findByIdAndUpdate(user._id, { creatorProfileId: creatorProfile._id });

  console.log("🎉 Creator account created successfully!");
  console.log(`   Email   : ${CREATOR_EMAIL}`);
  console.log(`   Password: ${CREATOR_PASSWORD}`);
  console.log(`   UserID  : ${user._id}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Done.");
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
