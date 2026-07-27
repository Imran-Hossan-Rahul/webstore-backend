// backend/craftsmans/rankingCraftsmanFixed.js
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { Worker as Craftsman } from "bullmq";
import Artifact from "../models/Artifact.model.js";

// -----------------------------
// MongoDB Connection
// -----------------------------



// -----------------------------
// Queue Events
// -----------------------------
const queueName = "ranking-queue";


// -----------------------------
// Craftsman
// -----------------------------
const craftsman = new Craftsman(
  queueName,
  async (job) => {
    const { artifactId } = job.data;
    if (!artifactId) throw new Error("Missing artifactId");
    console.log(`🛠️ Processing ranking job for artifact: ${artifactId}`);

    const tpl = await Artifact.findById(artifactId);
    if (!tpl) {
      console.warn("⚠️ Artifact not found for ranking:", artifactId);
      return;
    }

    // Update scores
    await tpl.updateScores();
    console.log(`📊 Scores updated for artifact: ${artifactId}`);

    // Update authoritative Redis zsets
    const trendingKeyAuth = "artifacts:trending:auth";
    const popularKeyAuth = "artifacts:popular:auth";

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
    console.log(`☑️ Redis zsets updated: ${artifactId}`);

    // Persist top10 snapshots
    const TOPN = 10;

    const topTrending = await connection.zrevrange(
      trendingKeyAuth,
      0,
      TOPN - 1
    );
    if (topTrending.length > 0) {
      const docs = await Artifact.find({
        _id: { $in: topTrending },
        isActive: true,
      })
        .lean()
        .populate("user", "name email");
      const map = new Map(docs.map((d) => [d._id.toString(), d]));
      const ordered = topTrending.map((id) => map.get(id)).filter(Boolean);
      await connection.set(
        "artifacts:trending:top10",
        JSON.stringify(ordered),
        "EX",
        60
      );
      console.log("📌 Trending top10 snapshot updated");
    }

    const topPopular = await connection.zrevrange(popularKeyAuth, 0, TOPN - 1);
    if (topPopular.length > 0) {
      const docs = await Artifact.find({
        _id: { $in: topPopular },
        isActive: true,
      })
        .lean()
        .populate("user", "name email");
      const map = new Map(docs.map((d) => [d._id.toString(), d]));
      const ordered = topPopular.map((id) => map.get(id)).filter(Boolean);
      await connection.set(
        "artifacts:popular:top10",
        JSON.stringify(ordered),
        "EX",
        60
      );
      console.log("📌 Popular top10 snapshot updated");
    }

    console.log(`✅ Ranking job finished for artifact: ${artifactId}`);
  },
  { connection: redis,
    concurrency: parseInt(process.env.RANKING_CRAFTSMAN_CONCURRENCY || "5", 10),
  }
);

craftsman.on("failed", (job, err) => {
  console.error(`❌ Ranking job failed: ${job.id}`, err);
});

console.log("🚀 Ranking Craftsman Started (Fixed Version)");



craftsman.on('error', () => {});
