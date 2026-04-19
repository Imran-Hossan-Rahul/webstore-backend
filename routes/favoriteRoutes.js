import express from "express";
import { toggleFavorite, getFavorites } from "../controllers/favoriteController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/toggle", protect, toggleFavorite);
router.get("/", protect, getFavorites);

export default router;
