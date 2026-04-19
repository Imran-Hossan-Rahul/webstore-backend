import express from "express";
import { uploadResource, uploadProjectResource } from "../controllers/resourceUploadController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/resource", protect, uploadResource.single("file"), uploadProjectResource);

export default router;
