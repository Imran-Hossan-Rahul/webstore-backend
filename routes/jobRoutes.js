import express from "express";
import { protect, optionalProtect, restrictTo } from "../middlewares/authMiddleware.js";
import {
  createJob,
  getJobs,
  getJobById,
  applyToJob,
  updateJob,
  updateApplicantStage,
  getMyProposals,
  acceptOffer,
  getProposalById
} from "../controllers/jobController.js";

const router = express.Router();

// Job board + create
router.route("/")
  .get(optionalProtect, getJobs)
  .post(protect, restrictTo("patron", "admin"), createJob);

// My proposals (craftsman)
router.get("/my-proposals", protect, getMyProposals);

// Proposal details
router.get("/proposals/:id", protect, getProposalById);

// Single job CRUD
router.route("/:id")
  .get(getJobById)
  .patch(protect, updateJob);

// Submit a proposal
router.post("/:id/apply", protect, applyToJob);

// Update applicant pipeline stage (patron action)
router.patch("/:id/applicants/:applicantId/stage", protect, updateApplicantStage);

// Accept formal offer (craftsman action)
router.post("/:id/applicants/accept-offer", protect, acceptOffer);

export default router;
