 * SEED SCRIPT — Wipe all users & create the single craftsman account.
 * Usage: node scripts/seed-craftsman.js
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const CRAFTSMAN_EMAIL = "imranhossanrahul.dev@gmail.com";
const CRAFTSMAN_PASSWORD = "12!@imraN";
const CRAFTSMAN_NAME = "Imran Hossan";
const CRAFTSMAN_DISPLAY_NAME = "Imran Hossan";

// ── Inline schemas (avoid side-effects from full model imports) ───────────────
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: { type: String, select: false },
    role: { type: String, default: "user" },
    hasCraftsmanAccount: { type: Boolean, default: false },
    craftsmanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "CraftsmanProfile" },
    skills: [String],
    interests: [String],
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
    hasCompletedOnboarding: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const craftsmanSchema = new mongoose.Schema(
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
  const CraftsmanProfile = mongoose.models.CraftsmanProfile || mongoose.model("CraftsmanProfile", craftsmanSchema, "craftsmanprofiles");

  // ── 1. Wipe everything ─────────────────────────────────────────────────────
  console.log("🗑️  Deleting all existing users and craftsman profiles...");
  await User.deleteMany({});
  await CraftsmanProfile.deleteMany({});
  console.log("✅ All users and craftsman profiles deleted.");

  // ── 2. Create hashed password ──────────────────────────────────────────────
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(CRAFTSMAN_PASSWORD, salt);

  // ── 3. Create the craftsman user ─────────────────────────────────────────────
  const user = await User.create({
    name: CRAFTSMAN_NAME,
    email: CRAFTSMAN_EMAIL,
    password: hashedPassword,
    role: "user",
    hasCraftsmanAccount: true,
    emailVerified: true,
    hasCompletedOnboarding: true,
    isActive: true,
  });

  // ── 4. Create the linked craftsman profile ──────────────────────────────────
  const craftsmanProfile = await CraftsmanProfile.create({
    userId: user._id,
    displayName: CRAFTSMAN_DISPLAY_NAME,
    bio: "Platform Craftsman & Developer",
    skills: ["Writing", "Development", "Design"],
    isVerified: true,
  });

  // ── 5. Link craftsman profile back to user ──────────────────────────────────
  await User.findByIdAndUpdate(user._id, { craftsmanProfileId: craftsmanProfile._id });

  console.log("🎉 Craftsman account created successfully!");
  console.log(`   Email   : ${CRAFTSMAN_EMAIL}`);
  console.log(`   Password: ${CRAFTSMAN_PASSWORD}`);
  console.log(`   UserID  : ${user._id}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Done.");
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
