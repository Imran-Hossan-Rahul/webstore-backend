import express from "express";
import { protect, restrictTo } from "../middlewares/authMiddleware.js";
import { submitTimeLog, getTimeLogs, updateTimeLogStatus } from "../controllers/timeLogController.js";

const router = express.Router();

router.route("/")
  .post(protect, restrictTo("user"), submitTimeLog); // Assuming craftsmans have "user" role initially, can expand later

router.route("/:contractId")
  .get(protect, getTimeLogs);

router.route("/:id/status")
  .patch(protect, restrictTo("patron", "admin"), updateTimeLogStatus);

export default router;
