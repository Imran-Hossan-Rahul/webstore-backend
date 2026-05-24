import express from "express";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(verifyAccessToken);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllRead);

export default router;
