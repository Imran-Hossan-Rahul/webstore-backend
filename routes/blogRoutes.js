import express from "express";
import multer from "multer";
import { createBlog, getAllBlogs, getSingleBlog, updateBlog, deleteBlog, publishBlog, getUserPublishedBlogs, trackBlogView, trackBlogImpressions, getBlogForEditor, getBlogAnalytics, likeBlog, addComment, getBlogComments, deleteComment, getPopularTopics } from "../controllers/blogController.js";
import { uploadCoverImage, getUploadStatus } from "../controllers/blogImageController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
const router = express.Router();

// Multer configuration for file uploads
const upload = multer({ dest: "uploads/" });

// PROTECTED ROUTES (Defined BEFORE generic /:slug to avoid conflicts)
router.get("/user/my-blogs", verifyAccessToken, getUserPublishedBlogs);
router.get("/editor-data/:slug", verifyAccessToken, getBlogForEditor);
router.get("/:slug/analytics", verifyAccessToken, getBlogAnalytics);

// Protected Routes (User Interaction)
router.post("/:slug/like", verifyAccessToken, likeBlog);
router.post("/:slug/comment", verifyAccessToken, addComment);
router.delete("/comment/:commentId", verifyAccessToken, deleteComment);

// PROTECTED ROUTES (Other)
router.post("/upload-cover-image", verifyAccessToken, upload.single("coverImage"), uploadCoverImage);
router.get("/upload-status/:jobId", verifyAccessToken, getUploadStatus);
router.post("/create-blog", verifyAccessToken, createBlog);

router.put("/:slug", verifyAccessToken, updateBlog);
router.delete("/:slug", verifyAccessToken, deleteBlog);

// PUBLIC ROUTES (Moved GET routes down)
router.get("/popular-topics", getPopularTopics);
router.get("/:slug/comments", getBlogComments);
router.get("/", getAllBlogs);
router.get("/:slug", getSingleBlog);
router.post("/:slug/view", trackBlogView);
router.post("/impression", trackBlogImpressions);

router.put("/:slug/publish", verifyAccessToken, publishBlog);
router.post("/:slug/publish", verifyAccessToken, publishBlog);

export default router;
