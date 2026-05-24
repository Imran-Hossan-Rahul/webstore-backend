// routes/gdprComplianceRoutes.js
// Routes for GDPR & Privacy Compliance
import express from "express";
import {
  getGDPRCompliance,
  updateConsent,
  requestDataAccess,
  requestDataErasure,
  requestDataPortability,
  objectToProcessing,
  getComplianceReport,
  getUsersDueForDeletion,
  processErasureRequest,
  exportUserData,
  requestExport,
} from "../controllers/gdprComplianceController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";

const router = express.Router();

// User routes (own data)
router.get("/:userId", verifyAccessToken, getGDPRCompliance);
router.post("/:userId/consent", verifyAccessToken, updateConsent);
router.post("/:userId/access", verifyAccessToken, requestDataAccess);
router.post("/:userId/erasure", verifyAccessToken, requestDataErasure);
router.post("/:userId/portability", verifyAccessToken, requestDataPortability);
router.post("/:userId/object", verifyAccessToken, objectToProcessing);
router.post("/export-request", verifyAccessToken, requestExport);
router.get("/:userId/export", verifyAccessToken, exportUserData);

// Admin routes
router.get("/report", verifyAccessToken, getComplianceReport);
router.get("/due-for-deletion", verifyAccessToken, getUsersDueForDeletion);
router.post("/process-erasure/:requestId", verifyAccessToken, processErasureRequest);

export default router;
