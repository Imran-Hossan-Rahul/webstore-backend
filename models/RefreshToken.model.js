import mongoose from "mongoose";
import crypto from "crypto";
import { promisify } from "util";
import cryptoJs from "crypto-js"; // Optional: for AES encryption


const randomBytesAsync = promisify(crypto.randomBytes);

// Helper: HMAC hash
function hashToken(token, secret) {
  return crypto.createHmac("sha256", secret).update(token)
                                                    .digest("hex");
}

// Optional AES encryption for tokenHash at rest
function encryptTokenHash(hash, encryptionKey) {
  return cryptoJs.AES.encrypt(hash, encryptionKey).toString();
}

function decryptTokenHash(ciphertext, encryptionKey) {
  return cryptoJs.AES.decrypt(ciphertext, encryptionKey).toString(
    cryptoJs.enc.Utf8
  );
}

const RefreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", 
                   required: true },
    deviceInfo: { type: String, default: null },
    ip: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true, 
                index: { expireAfterSeconds: 0 } }, // TTL
    revoked: { type: Boolean, default: false },
    replacedByTokenHash: { type: String, default: null },
    auditLogs: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        ip: String,
        deviceInfo: String,
      },
    ],
  },
  { timestamps: true }
);

// Compound index for efficient queries
RefreshTokenSchema.index({ user: 1, revoked: 1, deviceInfo: 1 });

// ------------------ Methods ------------------ //

// Compare token, check revoked & expiration
RefreshTokenSchema.methods.matchesToken = function (
  token,
  secret,
  encryptionKey = null
) {
  if (this.revoked || this.isExpired()) return false;
  const hash = hashToken(token, secret);
  if (encryptionKey) {
    try {
      const decryptedHash = decryptTokenHash(this.tokenHash, encryptionKey);
      return hash === decryptedHash;
    } catch (e) {
      return false;
    }
  }
  return hash === this.tokenHash;
};

// Check expiration
RefreshTokenSchema.methods.isExpired = function () {
  return Date.now() >= this.expiresAt.getTime();
};


// Revoke token with optional replacement and audit
RefreshTokenSchema.methods.revoke = async function (
  replacedByTokenHash = null,
  ip = null,
  deviceInfo = null
) {
  this.revoked = true;
  this.replacedByTokenHash = replacedByTokenHash;
  this.auditLogs.push({ action: "revoke", ip, deviceInfo });
  await this.save();
};

// Update lastUsedAt & audit usage
RefreshTokenSchema.methods.touch = async function (
  ip = null,
  deviceInfo = null
) {
  this.lastUsedAt = new Date();
  this.auditLogs.push({ action: "used", ip, deviceInfo });
  await this.save();
};

// Generate token & hash for DB
RefreshTokenSchema.statics.generateToken = async function (
  secret,
  encryptionKey = null
) {
  const token = (await randomBytesAsync(64))
          .toString("hex"); // 128-char token
  let tokenHash = hashToken(token, secret);
  if (encryptionKey) tokenHash = 
          encryptTokenHash(tokenHash, encryptionKey);
  return { token, tokenHash };
};

// Enforce single active token per device atomically
RefreshTokenSchema.statics.revokeOtherTokensForDevice = 
           async function (
  userId,
  deviceInfo
) {
  await this.updateMany(
    { user: userId, deviceInfo, revoked: false },
    { $set: { revoked: true } }
  );
};

// Optional: rotate version when issuing new token
RefreshTokenSchema.methods.incrementVersion = 
        async function () {
  this.version += 1;
  await this.save();
};

// ------------------ Serverless-safe Export ------------------ //
const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", RefreshTokenSchema);

export default RefreshToken;
