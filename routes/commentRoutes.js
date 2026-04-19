import express from "express";
import { addComment, getComments, toggleHelpful } from "../controllers/commentController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/:postId", protect, addComment);
router.get("/:postId", getComments);
router.patch("/:commentId/helpful", protect, toggleHelpful);

export default router;
