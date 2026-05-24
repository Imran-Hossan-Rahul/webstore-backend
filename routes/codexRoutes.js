import express from "express";
import multer from "multer";
import { createCodex, getAllCodex, getSingleCodex, updateCodex, deleteCodex, publishCodex, getUserPublishedCodex, trackCodexView, trackCodexImpressions, getCodexForEditor, getCodexAnalytics, likeCodex, addComment, getCodexComments, deleteComment, getPopularTopics } from "../controllers/codexController.js";
import { uploadCoverImage, getUploadStatus } from "../controllers/codexImageController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
const router = express.Router();

// Multer configuration for file uploads
const upload = multer({ dest: "uploads/" });

// PROTECTED ROUTES (Defined BEFORE generic /:slug to avoid conflicts)
router.get("/user/my-codex", verifyAccessToken, getUserPublishedCodex);
router.get("/editor-data/:slug", verifyAccessToken, getCodexForEditor);
router.get("/:slug/analytics", verifyAccessToken, getCodexAnalytics);

// Protected Routes (User Interaction)
router.post("/:slug/like", verifyAccessToken, likeCodex);
router.post("/:slug/comment", verifyAccessToken, addComment);
router.delete("/comment/:commentId", verifyAccessToken, deleteComment);

// PROTECTED ROUTES (Other)
router.post("/upload-cover-image", verifyAccessToken, upload.single("coverImage"), uploadCoverImage);
router.get("/upload-status/:jobId", verifyAccessToken, getUploadStatus);
router.post("/create-codex", verifyAccessToken, createCodex);

router.put("/:slug", verifyAccessToken, updateCodex);
router.delete("/:slug", verifyAccessToken, deleteCodex);

// PUBLIC ROUTES (Moved GET routes down)
router.get("/popular-topics", getPopularTopics);
router.get("/:slug/comments", getCodexComments);
router.get("/", getAllCodex);
router.get("/:slug", getSingleCodex);
router.post("/:slug/view", trackCodexView);
router.post("/impression", trackCodexImpressions);

router.put("/:slug/publish", verifyAccessToken, publishCodex);
router.post("/:slug/publish", verifyAccessToken, publishCodex);

export default router;


