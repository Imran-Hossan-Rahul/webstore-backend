import express from "express";
import { uploadResource, uploadDevlogResource } from "../controllers/resourceUploadController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/resource", protect, uploadResource.single("file"), uploadDevlogResource);

export default router;

