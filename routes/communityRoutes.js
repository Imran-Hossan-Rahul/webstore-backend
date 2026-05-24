import express from "express";
import {
  getActivities,
  updateActivity,
  getTasks,
  createTask,
  addSolution,
  getRooms,
  createRoom,
  joinRoom,
  createDiscussion,
  getDiscussions,
  addMessage,
  getMessages,
  markMessageAsRead
} from "../controllers/communityController.js";
import chatMediaUpload from "../config/chatMediaMulter.js";
import {
  getResources,
  createResource,
  downloadResource,
  likeResource
} from "../controllers/resourceController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Activity routes
router.get("/activities", optionalProtect, getActivities);
router.put("/activity", verifyAccessToken, updateActivity);

// Task routes
router.get("/tasks", verifyAccessToken, getTasks);
router.post("/tasks", verifyAccessToken, createTask);
router.post("/tasks/:taskId/solutions", verifyAccessToken, addSolution);

// Collaboration room routes
router.get("/rooms", verifyAccessToken, getRooms);
router.post("/rooms", verifyAccessToken, createRoom);
router.post("/rooms/:roomId/join", verifyAccessToken, joinRoom);

// Resource routes
router.get("/resources", verifyAccessToken, getResources);
router.post("/resources", verifyAccessToken, createResource);
router.post("/resources/:id/download", verifyAccessToken, downloadResource);
router.post("/resources/:id/like", verifyAccessToken, likeResource);

// Discussion routes
router.post("/discussions", verifyAccessToken, createDiscussion);
router.get("/discussions", verifyAccessToken, getDiscussions);
router.post("/discussions/:id/messages", verifyAccessToken, chatMediaUpload.array("media", 5), addMessage);
router.get("/discussions/:id/messages", verifyAccessToken, getMessages);
router.post("/discussions/:id/messages/:messageId/read", verifyAccessToken, markMessageAsRead);

export default router;
