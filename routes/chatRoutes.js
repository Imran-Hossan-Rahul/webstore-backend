import express from "express";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import {
  getUsers,
  getOrCreateChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  markAsRead
} from "../controllers/chatController.js";

const router = express.Router();

router.use(verifyAccessToken);

router.get("/users", getUsers);
router.get("/chats", getUserChats);
router.get("/chat/:userId", getOrCreateChat);
router.get("/messages/:chatId", getChatMessages);
router.post("/message/:chatId", sendMessage);
router.put("/read/:chatId", markAsRead);

export default router;
