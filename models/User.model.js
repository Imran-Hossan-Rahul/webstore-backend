// models/User.js
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new Schema(
  {
    // ===== Existing fields =====
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    // ===== Profile Fields =====
    profilePicture: { type: String, default: "" },
    coverPicture: { type: String, default: "" },
    bio: { type: String, maxlength: 500, default: "" },
    dateOfBirth: { type: Date }, // For analytics
    hasCompletedOnboarding: { type: Boolean, default: false },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    passwordHistory: [{ type: String, select: false }],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    
    // Creator Account Tracking
    hasCreatorAccount: { type: Boolean, default: false },
    creatorProfileId: {
      type: Schema.Types.ObjectId,
      ref: "CreatorProfile",
    },
    
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] }, // NEW FIELD
    workType: { type: String, enum: ["solo", "team"], default: "solo" },
    isSuperAdmin: { type: Boolean, default: false, select: false },

    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    lastFailedLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    auditLogs: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        ip: String,
      },
    ],
    
    // Favorites
    favorites: [{
        type: Schema.Types.ObjectId,
        ref: "Post"
    }],

    // Follow System
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // ===== Analytics Fields =====
    device: {
      type: String,
      enum: ["Mac", "Windows", "Linux", "Mobile", "Other"],
      default: "Other",
    },
    browser: { type: String, default: "Unknown" },
    ip: { type: String },
    location: {
      country: { type: String },
      city: { type: String },
    },
    referrer: { type: String, default: "Direct" }, // New field for source/referrer
    landingPage: { type: String }, // New field for first visited page
    sessions: [
      {
        timestamp: { type: Date, default: Date.now },
        device: String,
        browser: String,
        ip: String,
        referrer: String,
        landingPage: String,
      },
    ],

    // ===== Payout & Earnings Fields =====
    payoneerEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    payoutMethod: {
      type: String,
      enum: ["payoneer", "bank_transfer", "paypal", "stripe"],
      default: "payoneer",
    },
    bankDetails: {
      accountNumber: String,
      bankName: String,
      swiftCode: String,
      accountHolderName: String,
      country: String,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaidOut: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingPayout: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumPayoutThreshold: {
      type: Number,
      default: 50, // $50 minimum
    },
    payoutEnabled: {
      type: Boolean,
      default: false,
    },
    // ===== Gamification & Rewards =====
    gamification: {
      xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      points: { type: Number, default: 0 }, // Redeemable points
      streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastCheckIn: { type: Date }
      },
      badges: [{
        id: String,
        name: String,
        icon: String,
        earnedAt: { type: Date, default: Date.now },
        description: String
      }],
      completedChallenges: [{ type: String }] // IDs
    }
  },
  { timestamps: true }
);

// -------- Password Validation & Hashing ----------
userSchema.path("password").validate(function (value) {
  const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return complexity.test(value);
}, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character");

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);

    // Prevent password reuse
    if (this.passwordHistory) {
      for (let oldHash of this.passwordHistory) {
        if (await bcrypt.compare(this.password, oldHash)) {
          throw new Error("You cannot reuse an old password");
        }
      }
    } else {
      this.passwordHistory = [];
    }

    // Hash the new password first
    const hashedPassword = await bcrypt.hash(this.password, salt);

    // Save previous password hash
    if (this.passwordHistory.length >= 5) this.passwordHistory.shift();
    if (this.password) this.passwordHistory.push(hashedPassword);

    // Update current password
    this.password = hashedPassword;

    next();
  } catch (err) {
    next(err);
  }
});

// -------- Compare password ----------
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// -------- Login Attempt & Locking ----------
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 min

userSchema.methods.addAuditLog = function (action, ip) {
  this.auditLogs.push({ action, ip });
  if (this.auditLogs.length > 100) {
    this.auditLogs = this.auditLogs.slice(-100);
  }
};

// -------- Updated incrementLoginAttempts ----------
userSchema.methods.incrementLoginAttempts = async function (ip) {
  try {
    // Ensure loginAttempts is a number
    if (!this.loginAttempts) this.loginAttempts = 0;

    // If lock has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
      this.loginAttempts = 0;
      this.lockUntil = undefined;
    }

    this.loginAttempts += 1;
    this.lastFailedLogin = new Date();

    if (ip) this.addAuditLog("Failed login", ip);

    // Lock account if max attempts reached
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockUntil = new Date(Date.now() + LOCK_TIME);
    }

    await this.save();

    console.log(
      `Login attempts for ${this.email}: ${this.loginAttempts}, locked until: ${this.lockUntil}`
    );
  } catch (err) {
    console.error("Error incrementing login attempts:", err);
    throw err;
  }
};

userSchema.methods.resetLoginAttempts = async function (ip) {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = new Date();

  if (ip) this.addAuditLog("Successful login", ip);

  await this.save();
};

userSchema.methods.isLocked = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
    return false;
  }
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// -------- Role & Permission ----------
userSchema.methods.hasRole = function (role) {
  if (this.isSuperAdmin) return true;
  return this.role === role;
};

// -------- Email Verification & Password Reset ----------
userSchema.methods.generateEmailVerification = async function () {
  this.emailVerificationToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await this.save();
  return this.emailVerificationToken;
};

userSchema.methods.generatePasswordReset = async function () {
  this.passwordResetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await this.save();
  return this.passwordResetToken;
};

// -------- Security: Prevent Frontend changing SuperAdmin ----------
userSchema.methods.updateRoleSafely = async function (updates, updater) {
  if ("isSuperAdmin" in updates && !updater.isSuperAdmin) {
    delete updates.isSuperAdmin;
  }

  if (updates.role === "admin" && !updater.isSuperAdmin) {
    throw new Error("Only super admin can assign admin role");
  }

  Object.assign(this, updates);
  await this.save();
};

// ------ Serverless-safe Model Export ---------
const User =
  mongoose.models.User || mongoose.model("User", userSchema, "users");
export default User;
