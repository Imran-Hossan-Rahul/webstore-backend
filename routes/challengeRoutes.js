import express from "express";
import { protect, adminOnly, hostOnly } from "../middlewares/authMiddleware.js";
import { getChallenges, createChallenge, submitEntry, likeSubmission, getChallengeById, joinChallenge, addChallengeUpdate, updateChallengeStatus, updateChallengePhases, selectWinners, releasePayouts, scoreSubmission } from "../controllers/challengeController.js";
import { challengeUpload } from "../config/challengeMulter.js";

const router = express.Router();

router.route("/")
  .get(getChallenges)
  .post(protect, hostOnly, challengeUpload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "resourceFiles", maxCount: 5 }
  ]), createChallenge);

router.route("/:id")
  .get(getChallengeById);

router.route("/:id/join")
  .post(protect, joinChallenge);

router.route("/:id/submit")
  .post(protect, challengeUpload.fields([
    { name: 'screenshots', maxCount: 10 },
    { name: 'resourceFiles', maxCount: 5 }
  ]), submitEntry);

// Management Routes
router.route("/:id/updates")
  .post(protect, addChallengeUpdate);

router.route("/:id/status")
  .patch(protect, updateChallengeStatus);

router.route("/:id/phases")
  .patch(protect, updateChallengePhases);

router.route("/:id/winners")
  .post(protect, selectWinners);

router.route("/:id/payout")
  .post(protect, adminOnly, releasePayouts);

router.route("/:challengeId/submissions/:submissionId/like")
  .post(protect, likeSubmission);

router.route("/:id/submissions/:submissionId/score")
  .post(protect, scoreSubmission);

export default router;
