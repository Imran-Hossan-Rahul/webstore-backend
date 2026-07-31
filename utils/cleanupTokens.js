// utils/cleanupTokens.js
import RefreshToken from "../models/RefreshToken.model.js";
import logger from "./logger.js";

export const cleanupExpiredTokens = async () => {
  try {
    const result = await RefreshToken.deleteMany({
      $or: [{ revoked: true }, { expiresAt: { $lt: new Date() } }],
    });
    logger.info(`Cleanup Job: ${result.deletedCount} refresh tokens removed.`);
  } catch (err) {
    logger.error("Cleanup Job Error:", err);
  }
};
