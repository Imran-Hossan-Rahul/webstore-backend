import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { bookSession, getMySessions } from "../controllers/mentorshipController.js";

const router = express.Router();

router.post("/book", protect, bookSession);
router.get("/", protect, getMySessions);

export default router;
