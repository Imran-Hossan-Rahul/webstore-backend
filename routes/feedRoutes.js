import express from "express";
import { getFeed } from "../controllers/feedController.js";
import { getTrendingTags, getPopularCategories } from "../controllers/trendingController.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", optionalProtect, getFeed);
router.get("/trending-tags", optionalProtect, getTrendingTags);
router.get("/popular-categories", optionalProtect, getPopularCategories);

export default router;
