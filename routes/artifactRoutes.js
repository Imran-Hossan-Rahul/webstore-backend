// routes/artifactRoutes.js
import express from "express";
import multer from "multer";
import asyncHandler from "express-async-handler";
import fs from "fs";

import { rankingQueue } from "../queues/index.js";
import redis from "../utils/redisClient.js";
import { confirmPurchase, downloadArtifact } from "../controllers/downloadController.js";


import {
  createArtifact,
  getArtifacts,
  getArtifactById,
  getUserArtifacts,
  deleteArtifact,
  updateArtifact,
  upgradeArtifact,
  getArtifactCount,
  incrementDownload,
  getPopularArtifacts,
  getTrendingArtifacts,
  getEditorsChoiceArtifacts,
  shareArtifact,
  likeArtifact,
  addArtifactComment,
  getArtifactComments,
  deleteArtifactComment,
  buyArtifact
} from "../controllers/artifactController.js";

import { getPopularCategories, getTrendingArtifactTags } from "../controllers/artifactStatsController.js";

import { incrementImpression } from "../controllers/artifactController.js";
import { incrementView } from "../controllers/artifactController.js";
import { getArtifactAnalytics } from "../controllers/artifactAnalyticsController.js";

import {
  protect,
  artifactOwnerOrAdmin,
} from "../middlewares/authMiddleware.js";
import { createArtifactSchema } from "../validation/artifactValidation.js";


const router = express.Router();

/* ---------------------------------------
   MULTER CONFIG
----------------------------------------- */
// Ensure temp upload folders exist
const previewDir = "uploads/temp/previews";
const devlogDir = "uploads/temp/devlogs"; // ← change here
[previewDir, devlogDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "previewFile") cb(null, previewDir);
    else if (file.fieldname === "devlogFile") cb(null, devlogDir);
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
  } else if (file.fieldname === "devlogFile") {
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
    else cb(new Error("Devlog file must be zip/json/html/js/css"));
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
    { name: "devlogFile", maxCount: 1 },
  ]),
  validateBody(createArtifactSchema),
  createArtifact
);


// -----------------------------
// Impression Route
// -----------------------------
// router.post(
//   "/impression",
//   asyncHandler(async (req, res) => {
//     const { artifactIds } = req.body;
//     if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid artifactIds" });
//     }

//     const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
//     const pipeline = redis.pipeline();

//     for (const id of artifactIds) {
//       // Impression per day counter (optional)
//       pipeline.incr(`impressions:artifact:${id}:day:${today}`);
//       pipeline.expire(`impressions:artifact:${id}:day:${today}`, 86400 * 2);

//       // Delta for flushCraftsman (only if you want impression counted as view)
//       // pipeline.incr(`views:delta:${id}`);

//       // Quick leaderboard update
//       pipeline.zincrby("artifacts:trending:zset", 1, id);
//     }

//     await pipeline.exec();
//     console.log("🟢 /impression updated:", artifactIds.length, "artifacts");

//     return res.json({ success: true, counted: true });
//   })
// );

router.post("/impression", incrementImpression);

// Like and Comment Routes (Craftsman-based)
router.post("/:artifactId/like", protect, likeArtifact);
router.post("/:artifactId/comment", protect, addArtifactComment);
router.get("/:artifactId/comments", getArtifactComments);
router.delete("/comment/:commentId", protect, deleteArtifactComment);


router.post(
  "/:artifactId/download", protect, downloadArtifact
);


router.post("/:artifactId/confirm-purchase", protect, confirmPurchase);
router.post("/:id/buy", protect, buyArtifact);


// -----------------------------
router.post("/view/:id", asyncHandler(incrementView));


// -----------------------------
// Download Route
// -----------------------------
router.post(
  "/download/:id",
  asyncHandler(async (req, res) => {
    const artifactId = req.params.id;
    if (!artifactId)
      return res.status(400).json({ success: false, message: "Missing ID" });

    // Actor identification
    const actor =
      req.user?._id?.toString() ||
      req.ip ||
      req.headers["x-forwarded-for"] ||
      "anon";
    const cooldownKey = `downloads:artifact:${artifactId}:actor:${actor}`;

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
        `⚠️ Cooldown active for download artifact ${artifactId}, actor ${actor}`
      );
      return res
        .status(200)
        .json({ success: true, counted: false, message: "Cooldown active" });
    }

    // Delta increment
    const deltaKey = `downloads:delta:${artifactId}`;
    const delta = await redis.incr(deltaKey);

    // Quick popular ZSET update
    await redis.zincrby("artifacts:popular:zset", 3, artifactId); // downloads weighted
    console.log(
      `🟢 /download incremented: artifact ${artifactId}, delta=${delta}`
    );

    // Optional: enqueue flush if delta >= threshold
    const FLUSH_THRESHOLD = 10;
    if (delta >= FLUSH_THRESHOLD) {
      await rankingQueue.add(
        "flush-and-rank",
        { artifactId },
        { removeOnComplete: true, removeOnFail: true }
      );
      console.log(`🚀 Ranking flush enqueued for artifact ${artifactId}`);
    }

    return res.status(200).json({ success: true, counted: true });
  })
);



/* ---------------------------------------
   PUBLIC ROUTES
----------------------------------------- */

// Get all artifacts (with search/pagination)
router.get("/", getArtifacts);

// Get total artifact count
router.get("/count", getArtifactCount);

// Featured artifacts (popular / trending / editors choice)
router.get("/featured/popular", getPopularArtifacts);
router.get("/featured/trending", getTrendingArtifacts);
router.get("/featured/editors-choice", getEditorsChoiceArtifacts);

// Artifact stats
router.get("/popular-categories", getPopularCategories);
router.get("/trending-tags", getTrendingArtifactTags);

/* ---------------------------------------
   USER ROUTES (Protected)
----------------------------------------- */

// Logged-in user's artifacts
router.get("/my-artifacts", protect, getUserArtifacts);

// Artifact analytics
router.get("/:id/analytics", protect, getArtifactAnalytics);

// Get single artifact by ID (must be after specific routes like /count, /featured/*)
router.get("/:id", getArtifactById);



// Update artifact (Edit)
router.put(
  "/:id",
  protect,
  artifactOwnerOrAdmin,
  upload.fields([
    { name: "previewFile", maxCount: 1 },
    { name: "devlogFile", maxCount: 1 },
  ]),
  updateArtifact
);

// Upgrade artifact version
router.put(
  "/:id/upgrade",
  protect,
  artifactOwnerOrAdmin,
  upload.fields([
    { name: "previewFile", maxCount: 1 },
    { name: "devlogFile", maxCount: 1 },
  ]),
  upgradeArtifact
);

// Soft delete artifact
router.delete("/:id", protect, artifactOwnerOrAdmin, deleteArtifact);

/* ---------------------------------------
   INTERACTIONS (Views / Downloads)
----------------------------------------- */
router.post("/view/:id", incrementView);
router.post("/download/:id", incrementDownload);
router.post("/share/:id", shareArtifact);

export default router;


