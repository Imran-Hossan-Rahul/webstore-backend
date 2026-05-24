// backend/craftsmen/viewSyncWorkerFixed.js
import mongoose from "mongoose";
import cron from "node-cron";
import redis from "../config/redis.js";
import Artifact from "../models/Artifact.model.js";
import Codex from "../models/Codex.model.js";
import Post from "../models/Post.model.js";
import Interaction from "../models/Interaction.model.js";

const SYNC_INTERVAL = process.env.VIEWSYNC_CRON || "*/2 * * * *"; // every 2 min

cron.schedule(SYNC_INTERVAL, async () => {
  console.log("ðŸ”„ ViewSyncWorker cron started...");
  try {
    const keys = [];
    let cursor = "0";
    do {
      const res = await redis.scan(cursor, "MATCH", "views:*", "COUNT", 100);
      cursor = res[0];
      keys.push(...res[1]);
    } while (cursor !== "0");

    if (keys.length === 0) {
      console.log("â„¹ï¸ No view counts to sync");
      return;
    }

    const groupedKeys = {
      count: [], // artifacts
      codex: [],
      post: []
    };

    keys.forEach(key => {
      const parts = key.split(":");
      const type = parts[1];
      const id = parts[2];
      if (groupedKeys[type]) {
        groupedKeys[type].push({ key, id });
      }
    });

    const interactionsToInsert = [];
    const updates = [];

    const processGroup = async (group, Model, typeLabel, targetType) => {
      if (group.length === 0) return;
      
      for (const { key, id } of group) {
        try {
          const viewDataStr = await redis.get(key);
          if (!viewDataStr) continue;
          const viewData = JSON.parse(viewDataStr);
          const count = viewData.count || 0;
          if (count === 0) {
            await redis.del(key);
            continue;
          }

          // Prepare interactions for bulk insert
          if (viewData.viewers && viewData.viewers.length > 0) {
            viewData.viewers.forEach(viewer => {
              interactionsToInsert.push({
                targetId: id,
                targetType: targetType,
                userId: viewer.userId || null,
                type: "view",
                actor: {
                  ip: viewer.ip,
                  userAgent: viewer.userAgent,
                  country: viewer.country
                },
                timestamp: new Date(viewer.timestamp || Date.now())
              });
            });
          }

          // Prepare main document update
          const field = targetType === "Artifact" ? "viewsCount" : "views";
          
          if (targetType === "Codex") {
             const codex = await Model.findById(id);
             if (codex) {
                 const newViews = (codex.views || 0) + count;
                 if (newViews >= 100 && !codex.hasReceived100ViewsToken) {
                     // Award 1 token
                     const GamificationService = (await import("../services/GamificationService.js")).default;
                     if (codex.author) {
                        await GamificationService.awardRewards(codex.author.toString(), 'CODEX_100_READS').catch(err => console.error("Error awarding token:", err));
                     }
                     
                     updates.push(
                       Model.updateOne({ _id: id }, { $inc: { views: count }, $set: { hasReceived100ViewsToken: true } })
                     );
                 } else {
                     updates.push(
                       Model.updateOne({ _id: id }, { $inc: { views: count } })
                     );
                 }
             }
          } else {
             updates.push(
               Model.updateOne({ _id: id }, { $inc: { [field]: count } })
             );
          }

          await redis.del(key);
        } catch (err) {
          console.error(`âŒ ${typeLabel} processing failed ${id}:`, err.message);
        }
      }
    };

    await processGroup(groupedKeys.count, Artifact, "Artifact", "Artifact");
    await processGroup(groupedKeys.codex, Codex, "Codex", "Codex");
    await processGroup(groupedKeys.post, Post, "Post", "Post");

    // Execute bulk operations
    if (interactionsToInsert.length > 0) {
      await Interaction.insertMany(interactionsToInsert, { ordered: false });
      console.log(`âœ… Inserted ${interactionsToInsert.length} interactions`);
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`âœ… Updated ${updates.length} document counters`);
    }

  } catch (err) {
    console.error("âŒ ViewSyncWorker cron error:", err);
  }
});

console.log("ðŸš€ ViewSyncWorker Started - Syncing every 2 minutes (Relational Schema)");
