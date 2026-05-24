import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { createReview, getUserReviews } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", protect, createReview);
router.get("/user/:userId", getUserReviews);

export default router;
