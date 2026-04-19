import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { createJob, getJobs, getJobById, applyToJob } from "../controllers/jobController.js";

const router = express.Router();

router.route("/")
  .post(protect, createJob)
  .get(getJobs);

router.route("/:id")
  .get(getJobById);

router.route("/:id/apply")
  .post(protect, applyToJob);

export default router;
