import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import { connectToDatabase } from "../config/db.js";

console.log("🔧 Chat Message Craftsman starting...");

connectToDatabase()
  .then(() => console.log("✅ Chat Message Craftsman connected to MongoDB"))
  .catch((err) => console.error("❌ Chat Message Craftsman DB connection failed:", err));

/**
 * Chat Message Craftsman — Fan-out & Notification Processor
 *
 * The HTTP controller already writes the message to MongoDB and emits the
 * socket event for low latency. This craftsman handles the heavier async tasks
 * that don't need to block the HTTP response:
 *   - Sending push notifications to offline users
 *   - Updating unread counts per-participant
 *   - (Future) Analytics / message search indexing
 *
 * Job data shape:
 *   { chatId, messageId, senderId, participantIds, content, type }
 */
const craftsman = new Craftsman(
  "chat-message",
  async (job) => {
    const { chatId, messageId, senderId, participantIds, content, type } = job.data;

    if (!chatId || !messageId) {
      throw new Error(`[Job ${job.id}] Missing chatId or messageId`);
    }

    await job.updateProgress(10);

    const { getIO } = await import("../utils/socketManager.js");
    const User = (await import("../models/User.model.js")).default;
    const io = getIO();

    const validParticipants = (participantIds || []).filter(
      id => id.toString() !== senderId.toString()
    );

    if (validParticipants.length > 0) {
      try {
        // Chat messages are no longer converted into general Notifications
        // to prevent mixing chat with system notifications and double-toasts.
        console.log(`[Job ${job.id}] Chat message fan-out skipped general notification creation.`);
      } catch (notifErr) {
        console.error(`[Job ${job.id}] Failed during fan-out:`, notifErr.message);
      }
    }

    await job.updateProgress(100);
    return { chatId, messageId, processed: true };
  },
  {
    connection: redis,
    concurrency: 50,       // 50 notification jobs simultaneously
    limiter: {
      max: 500,            // 500 fan-out jobs per second
      duration: 1000,
    },
  }
);

craftsman.on("completed", (job) => {
  console.log(`✅ [Job ${job.id}] Message fan-out done`);
});

craftsman.on("failed", (job, err) => {
  console.error(`❌ [Job ${job.id}] Message fan-out failed:`, err.message);
});

console.log("🚀 Chat Message Craftsman Started  |  concurrency=50  |  limit=500/s");
