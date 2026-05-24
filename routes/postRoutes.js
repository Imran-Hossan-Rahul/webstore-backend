import express from "express";
import { createPost, createQuickPost, getPosts, getPostById, likePost, updatePost, viewPost, getMyPosts, getMyDevlogPosts, sharePost, markPostImpression, getPostAnalytics } from "../controllers/postController.js";
import { protect as authenticate, optionalProtect } from "../middlewares/authMiddleware.js";
import quickPostUpload from "../config/quickPostMulter.js";

const router = express.Router();

// Public/Feed (but checks auth for like/favorite status)
router.get("/", optionalProtect, getPosts);
router.post("/impression", markPostImpression); // Bulk impression tracking
router.get("/my-posts", authenticate, getMyPosts); // New endpoint for craftsman dashboard
router.get("/my-devlog-posts", authenticate, getMyDevlogPosts); // Devlog posts only
router.get("/:id", optionalProtect, getPostById);
router.post("/:id/view", viewPost); // Public view tracking
router.post("/:id/share", sharePost); // Public share tracking

// Protected
router.post("/", authenticate, quickPostUpload.array("media", 4), createQuickPost);
router.post("/create", authenticate, createPost);
router.put("/:id", authenticate, updatePost);
router.put("/:id/like", authenticate, likePost);
router.get("/:id/analytics", authenticate, getPostAnalytics);

export default router;


