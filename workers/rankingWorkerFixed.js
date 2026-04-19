// backend/workers/rankingWorkerFixed.js
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { Worker } from "bullmq";
import ButtonTemplate from "../models/Template.model.js";

// -----------------------------
// MongoDB Connection
// -----------------------------



// -----------------------------
// Queue Events
// -----------------------------
const queueName = "ranking-queue";


// -----------------------------
// Worker
// -----------------------------
const worker = new Worker(
  queueName,
  async (job) => {
    const { templateId } = job.data;
    if (!templateId) throw new Error("Missing templateId");
    console.log(`🛠️ Processing ranking job for template: ${templateId}`);

    const tpl = await ButtonTemplate.findById(templateId);
    if (!tpl) {
      console.warn("⚠️ Template not found for ranking:", templateId);
      return;
    }

    // Update scores
    await tpl.updateScores();
    console.log(`📊 Scores updated for template: ${templateId}`);

    // Update authoritative Redis zsets
    const trendingKeyAuth = "templates:trending:auth";
    const popularKeyAuth = "templates:popular:auth";

    await connection.zadd(
      trendingKeyAuth,
      tpl.trendingScore || 0,
      tpl._id.toString()
    );
    await connection.zadd(
      popularKeyAuth,
      tpl.popularityScore || 0,
      tpl._id.toString()
    );
    console.log(`☑️ Redis zsets updated: ${templateId}`);

    // Persist top10 snapshots
    const TOPN = 10;

    const topTrending = await connection.zrevrange(
      trendingKeyAuth,
      0,
      TOPN - 1
    );
    if (topTrending.length > 0) {
      const docs = await ButtonTemplate.find({
        _id: { $in: topTrending },
        isActive: true,
      })
        .lean()
        .populate("user", "name email");
      const map = new Map(docs.map((d) => [d._id.toString(), d]));
      const ordered = topTrending.map((id) => map.get(id)).filter(Boolean);
      await connection.set(
        "templates:trending:top10",
        JSON.stringify(ordered),
        "EX",
        60
      );
      console.log("📌 Trending top10 snapshot updated");
    }

    const topPopular = await connection.zrevrange(popularKeyAuth, 0, TOPN - 1);
    if (topPopular.length > 0) {
      const docs = await ButtonTemplate.find({
        _id: { $in: topPopular },
        isActive: true,
      })
        .lean()
        .populate("user", "name email");
      const map = new Map(docs.map((d) => [d._id.toString(), d]));
      const ordered = topPopular.map((id) => map.get(id)).filter(Boolean);
      await connection.set(
        "templates:popular:top10",
        JSON.stringify(ordered),
        "EX",
        60
      );
      console.log("📌 Popular top10 snapshot updated");
    }

    console.log(`✅ Ranking job finished for template: ${templateId}`);
  },
  { connection: redis,
    concurrency: parseInt(process.env.RANKING_WORKER_CONCURRENCY || "5", 10),
  }
);

worker.on("failed", (job, err) => {
  console.error(`❌ Ranking job failed: ${job.id}`, err);
});

console.log("🚀 Ranking Worker Started (Fixed Version)");
