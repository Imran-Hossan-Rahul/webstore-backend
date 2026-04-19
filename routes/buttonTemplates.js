// routes/templateRoutes.js
import express from "express";
import multer from "multer";
import asyncHandler from "express-async-handler";
import fs from "fs";

import { rankingQueue } from "../queues/index.js";
import redis from "../utils/redisClient.js";
import { confirmPurchase, downloadTemplate } from "../controllers/downloadController.js";


import {
  createTemplate,
  getTemplates,
  getUserTemplates,
  deleteTemplate,
  // updateTemplate,
  getTemplateCount,
  incrementDownload,
  getPopularTemplates,
  getTrendingTemplates,
  getEditorsChoiceTemplates,
  shareTemplate
} from "../controllers/buttonTemplateController.js";

import { incrementImpression } from "../controllers/buttonTemplateController.js";
import { incrementView } from "../controllers/buttonTemplateController.js";
import { getTemplateAnalytics } from "../controllers/templateAnalyticsController.js";

import {
  protect,
  templateOwnerOrAdmin,
} from "../middlewares/authMiddleware.js";
import {
  createTemplateSchema,
  // updateTemplateSchema,
} from "../validation/buttonTemplateValidation.js";
import { toggleLike } from "../controllers/likeController.js";


const router = express.Router();

/* ---------------------------------------
   MULTER CONFIG
----------------------------------------- */
// Ensure temp upload folders exist
const previewDir = "uploads/temp/previews";
const projectDir = "uploads/temp/projects"; // ← change here
[previewDir, projectDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "previewFile") cb(null, previewDir);
    else if (file.fieldname === "projectFile") cb(null, projectDir);
    else cb(new Error("Unknown field"));
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "previewFile") {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    )
      cb(null, true);
    else cb(new Error("Preview must be image/video"));
  } else if (file.fieldname === "projectFile") {
    const allowed = [
      "application/zip",
      "application/json",
      "text/javascript",
      "application/javascript",
      "text/css",
      "text/html",
      "application/octet-stream",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(zip|json|html|js|css)$/i)
    )
      cb(null, true);
    else cb(new Error("Project file must be zip/json/html/js/css"));
  } else cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}); // 50MB max

/* --------------------------------------
   VALIDATION MIDDLEWARE
----------------------------------------- */
const validateBody = (schema) =>
  asyncHandler(async (req, res, next) => {
    const { error } = schema().validate(req.body, { abortEarly: false });
    if (error)
      return res
        .status(400)
        .json({ success: false, errors: error.details.map((d) => d.message) });
    next();
  });

/* ---------------------------------------
   ROUTE
----------------------------------------- */
router.post(
  "/upload",
  protect,
  upload.fields([
    { name: "previewFile", maxCount: 1 },
    { name: "projectFile", maxCount: 1 },
  ]),
  validateBody(createTemplateSchema),
  createTemplate
);


// -----------------------------
// Impression Route
// -----------------------------
// router.post(
//   "/impression",
//   asyncHandler(async (req, res) => {
//     const { templateIds } = req.body;
//     if (!Array.isArray(templateIds) || templateIds.length === 0) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid templateIds" });
//     }

//     const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
//     const pipeline = redis.pipeline();

//     for (const id of templateIds) {
//       // Impression per day counter (optional)
//       pipeline.incr(`impressions:template:${id}:day:${today}`);
//       pipeline.expire(`impressions:template:${id}:day:${today}`, 86400 * 2);

//       // Delta for flushWorker (only if you want impression counted as view)
//       // pipeline.incr(`views:delta:${id}`);

//       // Quick leaderboard update
//       pipeline.zincrby("templates:trending:zset", 1, id);
//     }

//     await pipeline.exec();
//     console.log("🟢 /impression updated:", templateIds.length, "templates");

//     return res.json({ success: true, counted: true });
//   })
// );

router.post("/impression", incrementImpression);

router.post("/:templateId/like", protect, toggleLike); // no auth needed


router.post(
  "/:templateId/download", protect, downloadTemplate
);


router.post("/:templateId/confirm-purchase", protect, confirmPurchase);


// -----------------------------
router.post("/view/:id", asyncHandler(incrementView));


// -----------------------------
// Download Route
// -----------------------------
router.post(
  "/download/:id",
  asyncHandler(async (req, res) => {
    const templateId = req.params.id;
    if (!templateId)
      return res.status(400).json({ success: false, message: "Missing ID" });

    // Actor identification
    const actor =
      req.user?._id?.toString() ||
      req.ip ||
      req.headers["x-forwarded-for"] ||
      "anon";
    const cooldownKey = `downloads:template:${templateId}:actor:${actor}`;

    const DOWNLOAD_COOLDOWN_SECONDS = parseInt(
      process.env.DOWNLOAD_COOLDOWN_SECONDS || "60",
      10
    );

    const set = await redis.set(
      cooldownKey,
      "1",
      "NX",
      "EX",
      DOWNLOAD_COOLDOWN_SECONDS
    );

    if (!set) {
      console.log(
        `⚠️ Cooldown active for download template ${templateId}, actor ${actor}`
      );
      return res
        .status(200)
        .json({ success: true, counted: false, message: "Cooldown active" });
    }

    // Delta increment
    const deltaKey = `downloads:delta:${templateId}`;
    const delta = await redis.incr(deltaKey);

    // Quick popular ZSET update
    await redis.zincrby("templates:popular:zset", 3, templateId); // downloads weighted
    console.log(
      `🟢 /download incremented: template ${templateId}, delta=${delta}`
    );

    // Optional: enqueue flush if delta >= threshold
    const FLUSH_THRESHOLD = 10;
    if (delta >= FLUSH_THRESHOLD) {
      await rankingQueue.add(
        "flush-and-rank",
        { templateId },
        { removeOnComplete: true, removeOnFail: true }
      );
      console.log(`🚀 Ranking flush enqueued for template ${templateId}`);
    }

    return res.status(200).json({ success: true, counted: true });
  })
);



/* ---------------------------------------
   PUBLIC ROUTES
----------------------------------------- */

// Get all templates (with search/pagination)
router.get("/", getTemplates);

// Get total template count
router.get("/count", getTemplateCount);

// Featured templates (popular / trending / editors choice)
router.get("/featured/popular", getPopularTemplates);
router.get("/featured/trending", getTrendingTemplates);
router.get("/featured/editors-choice", getEditorsChoiceTemplates);

/* ---------------------------------------
   USER ROUTES (Protected)
----------------------------------------- */

// Logged-in user's templates
router.get("/my-templates", protect, getUserTemplates);

// Template analytics
router.get("/:id/analytics", protect, getTemplateAnalytics);



// Update template
router.put(
  "/:id",
  protect,
  templateOwnerOrAdmin,
  // validateBody(updateTemplateSchema),
  // updateTemplate
);

// Soft delete template
router.delete("/:id", protect, templateOwnerOrAdmin, deleteTemplate);

/* ---------------------------------------
   INTERACTIONS (Views / Downloads)
----------------------------------------- */
router.post("/view/:id", incrementView);
router.post("/download/:id", incrementDownload);
router.post("/share/:id", shareTemplate);

export default router;
