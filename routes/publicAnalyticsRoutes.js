// Public analytics routes
import express from "express";
const router = express.Router();
import {
  getPublicViewsHistory,
  getPublicDownloadsHistory,
  getPublicRevenueHistory,
  getPublicUsersHistory,
} from "../controllers/publicAnalyticsController.js";

// Public routes (no authentication required)
router.get("/views-history", getPublicViewsHistory);
router.get("/downloads-history", getPublicDownloadsHistory);
router.get("/revenue-history", getPublicRevenueHistory);
router.get("/users-history", getPublicUsersHistory);

export default router;
