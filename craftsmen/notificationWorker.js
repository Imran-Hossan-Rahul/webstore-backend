import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import { connectToDatabase } from "../config/db.js";
import Notification from "../models/Notification.model.js";

console.log("🔔 Notification Craftsman starting...");

connectToDatabase()
  .then(() => console.log("✅ Notification Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Notification Craftsman DB connection failed:", err));

/**
 * Notification Craftsman
 * Processes notification jobs: Saves to DB and emits socket event
 */
const craftsman = new Craftsman(
  "notification-queue",
  async (job) => {
    const { recipientId, data } = job.data;

    if (!recipientId || !data) {
      throw new Error(`[Job ${job.id}] Missing recipientId or data`);
    }

    // 1. Create Notification in DB with explicit ID from Fast Path
    const notification = await Notification.create({
      _id: data._id, // Use the pre-generated ID to match the UI Fast Path
      recipient: recipientId,
      ...data
    });

    // 2. Removed redundant socket emit:
    // The Fast Path already emitted the UI update, doing it here duplicates work.

    return { success: true, notificationId: notification._id };
  },
  {
    connection: redis,
    concurrency: 100, // Handle 100 notifications simultaneously per craftsman instance
    limiter: {
      max: 1000,      // Rate limit to 1000 per second
      duration: 1000,
    },
  }
);

craftsman.on("completed", (job) => {
  // Silent success to reduce logs in high volume
});

craftsman.on("failed", (job, err) => {
  console.error(`❌ [Job ${job.id}] Notification delivery failed:`, err.message);
});

console.log("🚀 Notification Craftsman Started | concurrency=100 | limit=1000/s");

craftsman.on('error', () => {});
