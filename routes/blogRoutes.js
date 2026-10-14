import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  createCategory,
  getCategories,
} from "../controllers/blogCategoryController.js";
import {
  createBlog,
  getBlogs,
  getBlogBySlug,
  incrementBlogView,
} from "../controllers/blogController.js";

const router = express.Router();

// =======================
// Blog Category Routes
// =======================
router.post("/categories", protect, createCategory); // Assume Admin/SuperAdmin handled in controller or via role middleware
router.get("/categories", getCategories);

// =======================
// Blog Routes
// =======================
router.post("/", protect, createBlog);
router.get("/", getBlogs);
router.get("/:slug", getBlogBySlug);
router.post("/:slug/view", incrementBlogView);

export default router;
