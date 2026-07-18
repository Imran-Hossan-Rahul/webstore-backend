// services/auth.service.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import ms from "ms";
import RefreshToken from "../models/RefreshToken.model.js";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  JWT_ISSUER,
} from "../config/index.js";

// ---- Helpers ----
const parseExpiryMs = (expiryStr) =>
  typeof expiryStr === "number" ? expiryStr : ms(expiryStr);

const hashToken = (token) =>
  crypto.createHmac("sha256", JWT_REFRESH_SECRET).update(token).digest("hex");

// ---- Access Token ----
export const generateAccessToken = (user) => {
  const payload = {
    id: user._id.toString(),
    role: user.role,
    isSuperAdmin: user.isSuperAdmin || false, // ✅ FIX: was missing — superadmin couldn't access /admin
    hasCraftsmanAccount: user.hasCraftsmanAccount || false,
    isHost: user.isHost || false,
  };
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: JWT_ISSUER,
    algorithm: "HS256",
  });
};

// ---- Refresh Token ----
export const generateRefreshToken = async (
  user,
  deviceInfo = null,
  ip = null
) => {
  // Max 5 active tokens per user
  const activeTokens = await RefreshToken.find({
    user: user._id,
    revoked: false,
  });
  if (activeTokens.length >= 5) {
    const oldest = activeTokens.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
    await oldest.revoke(null, oldest.ip, oldest.deviceInfo);
  }

  // Create JWT
  const token = jwt.sign({ id: user._id.toString() }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    issuer: JWT_ISSUER,
    algorithm: "HS256",
  });

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseExpiryMs(JWT_REFRESH_EXPIRY));

  const refreshTokenDoc = await RefreshToken.create({
    tokenHash,
    user: user._id,
    deviceInfo,
    ip,
    expiresAt,
    version: 1,
    auditLogs: [{ action: "created", ip, deviceInfo, timestamp: new Date() }],
  });

  return { token, refreshTokenDoc };
};

// ---- Verify Refresh Token ----
export const verifyRefreshToken = async (
  token,
  deviceInfo = null,
  ip = null
) => {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  } catch {
    return { valid: false, reason: "invalid_token" };
  }

  const hash = hashToken(token);
  const record = await RefreshToken.findOne({
    tokenHash: hash,
    user: decoded.id,
  }).populate("user");

  if (!record) return { valid: false, reason: "not_found" };
  if (!record.user) return { valid: false, reason: "user_missing" };
  if (record.revoked) return { valid: false, reason: "revoked" };
  if (record.isExpired()) return { valid: false, reason: "expired" };

  // Device mismatch soft log
  if (deviceInfo && record.deviceInfo && record.deviceInfo !== deviceInfo) {
    record.auditLogs.push({
      action: "device_mismatch",
      ip,
      deviceInfo,
      timestamp: new Date(),
    });
    await record.save();
  }

  return { valid: true, record };
};

// ---- Rotate Token ----
export const rotateRefreshToken = async (
  oldRecord,
  deviceInfo = null,
  ip = null
) => {
  oldRecord.revoked = true;
  oldRecord.auditLogs.push({
    action: "rotated",
    ip,
    deviceInfo,
    timestamp: new Date(),
  });
  await oldRecord.save();

  const { token, refreshTokenDoc } = await generateRefreshToken(
    oldRecord.user,
    deviceInfo,
    ip
  );

  oldRecord.replacedByTokenHash = refreshTokenDoc.tokenHash;
  await oldRecord.save();

  return { token, refreshTokenDoc };
};

// ---- Revoke single token ----
export const revokeRefreshToken = async (token) => {
  const hash = hashToken(token);
  const rec = await RefreshToken.findOne({ tokenHash: hash });
  if (!rec) return false;
  await rec.revoke(null, rec.ip, rec.deviceInfo);
  return true;
};

// ---- Revoke all tokens for a user ----
export const revokeAllRefreshTokensForUser = async (userId) => {
  await RefreshToken.updateMany(
    { user: userId, revoked: false },
    {
      $set: { revoked: true },
      $push: { auditLogs: { action: "revoke_all", timestamp: new Date() } },
    }
  );
};

