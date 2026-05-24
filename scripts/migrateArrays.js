// backend/scripts/migrateArrays.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";
import Artifact from "../models/Artifact.model.js";
import Codex from "../models/codex.model.js";
import Interaction from "../models/Interaction.model.js";
import AuditLog from "../models/AuditLog.model.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/webstore";

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("🚀 Connected to MongoDB for migration");

    // 1. Migrate User Followers (Note: This requires a 'Follow' model if not already present, 
    // but the plan says we use a dedicated collection. Let's check if Follow model exists.)
    // Actually, I'll focus on the telemetry first as it's the biggest bloat.

    // 2. Migrate Artifact Telemetry
    console.log("📦 Migrating Artifact history...");
    const artifacts = await Artifact.find({ 
      $or: [
        { viewHistory: { $exists: true, $not: { $size: 0 } } },
        { downloadHistory: { $exists: true, $not: { $size: 0 } } },
        { auditLogs: { $exists: true, $not: { $size: 0 } } }
      ]
    });

    const artifactInteractions = [];
    const artifactAuditLogs = [];

    for (const art of artifacts) {
      // Views
      if (art.viewHistory) {
        art.viewHistory.forEach(vh => {
          if (vh.viewers) {
            vh.viewers.forEach(v => {
              artifactInteractions.push({
                targetId: art._id,
                targetType: "Artifact",
                userId: v.userId || null,
                type: "view",
                actor: { ip: v.ip, userAgent: v.userAgent, country: v.country },
                timestamp: v.timestamp || vh.date
              });
            });
          }
        });
      }

      // Downloads
      if (art.downloadHistory) {
        art.downloadHistory.forEach(dh => {
          artifactInteractions.push({
            targetId: art._id,
            targetType: "Artifact",
            userId: dh.userId || null,
            type: "download",
            timestamp: dh.timestamp
          });
        });
      }

      // Audit Logs
      if (art.auditLogs) {
        art.auditLogs.forEach(al => {
          artifactAuditLogs.push({
            targetId: art._id,
            targetType: "Artifact",
            actorId: al.actor || null,
            action: al.action,
            ip: al.ip,
            userAgent: al.userAgent,
            details: { byAdmin: al.byAdmin },
            timestamp: al.timestamp
          });
        });
      }
    }

    if (artifactInteractions.length > 0) {
      await Interaction.insertMany(artifactInteractions, { ordered: false });
      console.log(`✅ Migrated ${artifactInteractions.length} artifact interactions`);
    }

    if (artifactAuditLogs.length > 0) {
      await AuditLog.insertMany(artifactAuditLogs, { ordered: false });
      console.log(`✅ Migrated ${artifactAuditLogs.length} artifact audit logs`);
    }

    // 3. Migrate Codex Telemetry
    console.log("📦 Migrating Codex history...");
    const codexes = await Codex.find({});
    const codexInteractions = [];

    for (const doc of codexes) {
      if (doc.viewHistory) {
        doc.viewHistory.forEach(vh => {
          if (vh.viewers) {
            vh.viewers.forEach(v => {
              codexInteractions.push({
                targetId: doc._id,
                targetType: "Codex",
                userId: v.userId || null,
                type: "view",
                actor: { ip: v.ip, userAgent: v.userAgent, country: v.country },
                timestamp: v.timestamp || vh.date
              });
            });
          }
        });
      }
    }

    if (codexInteractions.length > 0) {
      await Interaction.insertMany(codexInteractions, { ordered: false });
      console.log(`✅ Migrated ${codexInteractions.length} codex interactions`);
    }

    // 4. Migrate User Audit Logs & Sessions
    console.log("📦 Migrating User history...");
    const users = await User.find({
      $or: [
        { auditLogs: { $exists: true } },
        { sessions: { $exists: true } }
      ]
    });

    const userAuditLogs = [];

    for (const user of users) {
      if (user.auditLogs) {
        user.auditLogs.forEach(al => {
          userAuditLogs.push({
            targetId: user._id,
            targetType: "User",
            action: al.action,
            ip: al.ip,
            timestamp: al.timestamp
          });
        });
      }

      if (user.sessions) {
        user.sessions.forEach(s => {
          userAuditLogs.push({
            targetId: user._id,
            targetType: "User",
            action: "Session Login",
            ip: s.ip,
            details: { browser: s.browser, device: s.device, referrer: s.referrer },
            timestamp: s.timestamp
          });
        });
      }
    }

    if (userAuditLogs.length > 0) {
      await AuditLog.insertMany(userAuditLogs, { ordered: false });
      console.log(`✅ Migrated ${userAuditLogs.length} user events`);
    }

    console.log("🏁 Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
