import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getContract,
  getMyContracts,
  submitMilestoneWork,
  approveMilestone,
  releaseMilestone,
  disputeMilestone,
  acceptAgreement,
  startTimer,
  stopTimer,
  getTimeLogs,
  addTimeSnapshot,
  createContract,
  fundContract,
  uploadSubmissionFile,
  closeContract,
  resolveDispute,
  updateOffer,
  declineOffer
} from "../controllers/contractController.js";
import { submissionUpload } from "../config/submissionMulter.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyContracts);
router.post("/", createContract);
router.post("/upload", submissionUpload.single("file"), uploadSubmissionFile);
router.get("/:id", getContract);
router.patch("/:id/accept-agreement", acceptAgreement);
router.patch("/:id/accept", acceptAgreement); // Alias for convenience
router.patch("/:id/activate", acceptAgreement); // Alias for patron activation
router.patch("/:id/decline", declineOffer);
router.patch("/:id/offer", updateOffer);
router.post("/:id/fund", fundContract);
router.patch("/:id/close", closeContract);

router.post("/:id/milestones/:milestoneId/submit", submissionUpload.fields([
  { name: 'screenshots', maxCount: 10 },
  { name: 'resourceFiles', maxCount: 5 }
]), submitMilestoneWork);
router.patch("/:id/milestones/:milestoneId/approve", approveMilestone);
router.patch("/:id/milestones/:milestoneId/release", releaseMilestone);
router.patch("/:id/milestones/:milestoneId/dispute", disputeMilestone);
router.post("/:id/milestones/:milestoneId/resolve", resolveDispute);

// Time Tracking Routes
router.post("/:id/time-logs/start", startTimer);
router.patch("/:id/time-logs/:logId/stop", stopTimer);
router.post("/:id/time-logs/:logId/snapshot", addTimeSnapshot);
router.get("/:id/time-logs", getTimeLogs);

export default router;
