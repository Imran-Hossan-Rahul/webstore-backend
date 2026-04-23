import express from "express";
import { getFeed } from "../controllers/feedController.js";
import { getTrendingTags } from "../controllers/trendingController.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", optionalProtect, getFeed);
router.get("/trending-tags", getTrendingTags);

export default router;
