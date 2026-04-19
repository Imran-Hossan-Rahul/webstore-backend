import express from "express";
import { getFeed } from "../controllers/feedController.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", optionalProtect, getFeed);

export default router;
