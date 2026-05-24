import { Queue } from "bullmq";
import redis from "../config/redis.js";

/**
 * Notification Queue
 * Handles high-volume notification delivery (DB writes + Socket emits)
 */
const notificationQueue = new Queue("notification-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

export const addNotificationJob = async (recipientId, data) => {
  await notificationQueue.add("process-notification", { recipientId, data });
};

export const addBulkNotificationJobs = async (jobsData) => {
  const jobs = jobsData.map(job => ({
    name: "process-notification",
    data: { recipientId: job.recipientId, data: job.data },
  }));
  await notificationQueue.addBulk(jobs);
};

export default notificationQueue;
