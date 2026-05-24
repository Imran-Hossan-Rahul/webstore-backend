import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { createSquad, getSquads, joinSquad } from "../controllers/squadController.js";

const router = express.Router();

router.post("/", protect, createSquad);
router.get("/", getSquads);
router.post("/:id/join", protect, joinSquad);

export default router;
