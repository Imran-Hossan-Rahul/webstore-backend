import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { getChallenges, createChallenge, submitEntry } from "../controllers/challengeController.js";

const router = express.Router();

router.route("/")
  .get(getChallenges)
  .post(protect, createChallenge);

router.route("/:id/submit")
  .post(protect, submitEntry);

export default router;
