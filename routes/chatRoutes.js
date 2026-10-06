import express from "express";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import {
  getUsers,
  getOrCreateChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  markAsRead,
  uploadMedia,
  getUnreadChatsCount,
  deleteMessage,
  getOrCreateSupportChat,
  markChatsSeen,
  getOrCreateOrderRoom
} from "../controllers/chatController.js";
import chatMediaUpload from "../config/chatMediaMulter.js";

const router = express.Router();

router.use(verifyAccessToken);

// Specific routes first to avoid conflict with dynamic routes
router.get("/unread-count", getUnreadChatsCount);
router.put("/seen", markChatsSeen);
router.get("/users", getUsers);
router.get("/chats", getUserChats);

// Dynamic routes after
router.get("/support", getOrCreateSupportChat);
router.get("/order/:orderId", getOrCreateOrderRoom);
router.get("/chat/:userId", getOrCreateChat);
router.get("/messages/:chatId", getChatMessages);
router.post("/message/:chatId", sendMessage);
router.put("/read/:chatId", markAsRead);
router.post("/upload-media/:chatId", chatMediaUpload.single("file"), uploadMedia);
router.delete("/message/:messageId", deleteMessage);

export default router;
