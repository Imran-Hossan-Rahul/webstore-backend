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
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
      minlength: 3,
      maxlength: 30,
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
    role: { type: String, enum: ["user", "patron", "admin", "superadmin"], default: "user" },
    
    // Patron Account Tracking
    companyDetails: {
      name: { type: String, default: "" },
      website: { type: String, default: "" },
      industry: { type: String, default: "" }
    },
    
    // Craftsman Account Tracking
    hasCraftsmanAccount: { type: Boolean, default: false },
    craftsmanProfileId: {
      type: Schema.Types.ObjectId,
      ref: "CraftsmanProfile",
    },
    
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] }, // NEW FIELD
    workType: { type: String, enum: ["solo", "team"], default: "solo" },
    gender: { type: String, default: "" },
    isSuperAdmin: { type: Boolean, default: false, select: false },

    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    lastFailedLogin: { type: Date },
    lastActiveAt: { type: Date }, // NEW FIELD
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    emailChangeToken: { type: String },
    emailChangeExpires: { type: Date },
    pendingEmail: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    // Audit logs, followers, and sessions are now moved to separate collections for scalability
    
    // Favorites
    favorites: [{
        type: Schema.Types.ObjectId,
        ref: "Post"
    }],

    // Follow System

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

    // ===== Payout & Earnings Fields =====
    payoutMethod: {
      type: String,
      enum: ["internal_wallet", "bank_transfer", "payoneer"],
      default: "internal_wallet",
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
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumPayoutThreshold: {
      type: Number,
      default: 50, // 50 TKNS minimum
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
    },
    
    // Enterprise Verification System
    isVerified: { type: Boolean, default: false },
    verificationStatus: { 
        type: String, 
        enum: ["unverified", "pending", "approved", "rejected"], 
        default: "unverified" 
    },
    verificationLevel: {
        type: String,
        enum: ["none", "individual", "company", "enterprise"],
        default: "none"
    },
    verificationGrants: {
        tier1Awarded: { type: Boolean, default: false }, // Email/Phone
        tier2Awarded: { type: Boolean, default: false }, // LinkedIn/GitHub
        tier3Awarded: { type: Boolean, default: false }, // Profile Completion
    },
    professionalLinks: {
        linkedin: { type: String, default: "" },
        github: { type: String, default: "" },
        portfolio: { type: String, default: "" },
        twitter: { type: String, default: "" },
    },
    isHost: { type: Boolean, default: false },

    // ===== Profile Extras =====
    pronouns: { type: String, default: "" },
    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "vacation", "unavailable"],
      default: "available"
    },
    hourlyRate: { type: Number, default: 0 },
    mentorshipRate: { type: Number, default: 50 },
    openToWork: { type: Boolean, default: false },

    // ===== Notification Preferences =====
    notificationPreferences: {
      email: {
        newFollower:      { type: Boolean, default: true },
        newComment:       { type: Boolean, default: true },
        newLike:          { type: Boolean, default: false },
        newJob:           { type: Boolean, default: true },
        challengeUpdates: { type: Boolean, default: true },
        weeklyDigest:     { type: Boolean, default: true },
        marketingEmails:  { type: Boolean, default: false }
      },
      inApp: {
        newFollower:      { type: Boolean, default: true },
        newComment:       { type: Boolean, default: true },
        newLike:          { type: Boolean, default: true },
        newJob:           { type: Boolean, default: true },
        challengeUpdates: { type: Boolean, default: true }
      }
    },

    // ===== Privacy Settings =====
    privacySettings: {
      profileVisibility:   { type: String, enum: ["public", "private", "connections"], default: "public" },
      whoCanMessage:       { type: String, enum: ["everyone", "followers", "nobody"], default: "everyone" },
      showOnlineStatus:    { type: Boolean, default: true },
      showLocation:        { type: Boolean, default: true },
      allowSearchIndexing: { type: Boolean, default: true },
      readReceipts:        { type: Boolean, default: true },
      showFollowerCount:   { type: Boolean, default: true }
    },

    // ===== Appearance Preferences =====
    appearancePreferences: {
      theme:       { type: String, enum: ["dark", "light", "system"], default: "system" },
      language:    { type: String, default: "en" },
      timezone:    { type: String, default: "Asia/Dhaka" },
      currency:    { type: String, default: "USD" },
      defaultFeed: { type: String, enum: ["trending", "following", "recommended"], default: "trending" }
    },

    // ===== Connected Accounts =====
    connectedAccounts: {
      github:   { connected: { type: Boolean, default: false }, username: String, connectedAt: Date },
      google:   { connected: { type: Boolean, default: false }, email: String, connectedAt: Date },
      linkedin: { connected: { type: Boolean, default: false }, profileUrl: String, connectedAt: Date }
    },

    // ===== Blocked Users & Muted Keywords =====
    blockedUsers:   [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedKeywords:  [{ type: String }],

    // ===== API Tokens =====
    apiTokens: [{
      name:      { type: String, required: true },
      tokenHash: { type: String, required: true, select: false },
      prefix:    { type: String },
      lastUsed:  { type: Date },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date }
    }]
  },
  { timestamps: true }
);

// Add text index for efficient searching
userSchema.index({ name: 'text', username: 'text', email: 'text', bio: 'text', skills: 'text' });

// -------- Password Validation & Hashing ----------
userSchema.path("password").validate(function (value) {
  // Only validate complexity if the password is being modified (is plain text)
  if (!this.isModified("password")) return true;
  
  const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return complexity.test(value);
}, "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character");

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);

    // Prevent password reuse
    // 🚀 BUG FIX: Ensure passwordHistory is loaded before validation
    if (this.isModified("password")) {
      if (!this.isSelected("passwordHistory")) {
        const userWithHistory = await mongoose.model("User").findById(this._id).select("+passwordHistory");
        this.passwordHistory = userWithHistory ? userWithHistory.passwordHistory : [];
      }

      if (this.passwordHistory && this.passwordHistory.length > 0) {
        for (let oldHash of this.passwordHistory) {
          if (await bcrypt.compare(this.password, oldHash)) {
            throw new Error("You cannot reuse an old password");
          }
        }
      } else {
        this.passwordHistory = this.passwordHistory || [];
      }
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

userSchema.methods.addAuditLog = async function (action, ip, details = {}) {
  try {
    const AuditLog = mongoose.model("AuditLog");
    await AuditLog.create({
      targetId: this._id,
      targetType: "User",
      action,
      ip,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Audit log creation failed:", err.message);
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
  this.emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationExpires = new Date(Date.now() + 5 * 60 * 1000);
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

