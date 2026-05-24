import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import axios from "axios";
import Artifact from "../models/Artifact.model.js";
import User from "../models/User.model.js";
import logger from "../utils/logger.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import { scanQueue } from "../queues/scanQueue.js";
import { rankingQueue } from "../queues/index.js";
import redis from "../utils/redisClient.js"; 
import { CACHE_TTL } from "../config/constants.js"; 
import { shareQueue } from "../queues/shareQueue.js";
import { postLikeQueue } from "../queues/postLikeQueue.js";
import { postCommentQueue } from "../queues/postCommentQueue.js";
import Transaction from "../models/Transaction.model.js";
import Comment from "../models/Comment.model.js";
import { fastValidateUploadedFiles } from "../utils/fastValidator.js";

const VIEW_COOLDOWN_SECONDS = parseInt(
  process.env.VIEW_COOLDOWN_SECONDS || "60",
  10
);
const DOWNLOAD_COOLDOWN_SECONDS = parseInt(
  process.env.DOWNLOAD_COOLDOWN_SECONDS || "60",
  10
);
const IMPRESSION_COOLDOWN_SECONDS = parseInt(
  process.env.IMPRESSION_COOLDOWN_SECONDS || "60",
  10
);

const TRENDING_ZSET = "artifacts:trending:zset";
const POPULAR_ZSET = "artifacts:popular:zset";
const FLUSH_THRESHOLD = 50;

/* ------------------ CREATE ARTIFACT ------------------ */
export const createArtifact = asyncHandler(async (req, res) => {

  if (!req.files?.previewFile?.[0] || !req.files?.devlogFile?.[0]) {
    return res.status(400).json({
      success: false,
      errors: ["Preview file and Devlog file are required"],
    });
  }

  // ⚡ FAST VALIDATION (instant - no blocking)
  const validation = fastValidateUploadedFiles(req.files);
  if (!validation.valid) {
    // Clean up uploaded files
    if (req.files.previewFile?.[0]?.path && fs.existsSync(req.files.previewFile[0].path)) {
      fs.unlinkSync(req.files.previewFile[0].path);
    }
    if (req.files.devlogFile?.[0]?.path && fs.existsSync(req.files.devlogFile[0].path)) {
      fs.unlinkSync(req.files.devlogFile[0].path);
    }
    
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }

  const previewFile = req.files.previewFile[0];
  const devlogFile = req.files.devlogFile[0];

  if (
    !previewFile.mimetype.startsWith("image/") &&
    !previewFile.mimetype.startsWith("video/")
  ) {
    return res.status(400).json({
      success: false,
      errors: ["Preview must be image or video"],
    });
  }

  const uploadedPreview = await cloudinary.uploader.upload(previewFile.path, {
    folder: "artifact_previews",
    resource_type: previewFile.mimetype.startsWith("video/")
      ? "video"
      : "image",
  });
  if (fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);

  // Upload devlog file to Cloudinary
  const uploadedDevlog = await cloudinary.uploader.upload(devlogFile.path, {
    folder: "artifact_devlogs",
    resource_type: "raw", // For zip files
    public_id: `artifact_${Date.now()}_${devlogFile.originalname.replace(/\.[^/.]+$/, "")}`,
  });
  if (fs.existsSync(devlogFile.path)) fs.unlinkSync(devlogFile.path);

  let artifact = await Artifact.create({
    user: req.user?._id,
    ...req.body,
    tags: req.body.tags ? req.body.tags.split(",").map((t) => t.trim()) : [],
    tech: req.body.tech ? (Array.isArray(req.body.tech) ? req.body.tech : req.body.tech.split(",")).map((t) => t.trim()) : [],
    price: req.body.priceType === "paid" ? req.body.price : 0,
    cardShape: req.body.cardShape || "square-medium",
    previewFile: uploadedPreview.secure_url,
    devlogFile: uploadedDevlog.secure_url,
    fileType: devlogFile.mimetype,
    fileSize: devlogFile.size,
    sourceType: "user",
    status: "pending", // Changed from "approved" to "pending" for background scan
  });

  artifact = await Artifact.findById(artifact._id);
  await artifact.addAuditLog(
    "Artifact uploaded",
    req.ip,
    req.headers["user-agent"],
    req.user?._id
  );
  await artifact.updateScores();

  // 🚀 ENQUEUE BACKGROUND SCAN (non-blocking)
  await scanQueue.add(
    'scan-artifact',
    {
      artifactId: artifact._id.toString(),
      devlogFileUrl: uploadedDevlog.secure_url,
      devlogFilePath: null, // Already uploaded to Cloudinary
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.info(`Artifact ${artifact._id} uploaded, scan queued`);

  return res.status(201).json({
    success: true,
    message: "Artifact uploaded successfully. Security scan in progress.",
    data: artifact,
  });
});

/* ------------------ GET ARTIFACTS ------------------ */
export const getArtifacts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const {
      search = "",
      priceType = "",
      category = "",
      tags = "",
      sortBy = "",
      userId = "",
    } = req.query;
    const query = {};

    if (userId) {
      query.user = userId;
      // If it's NOT the owner requesting, only show approved artifacts
      const isOwner = req.user && (req.user._id.toString() === userId.toString());
      if (!isOwner) {
        query.status = "approved";
      }
    } else {
      // Default view: only approved
      query.status = "approved";
    }

    if (search) query.$text = { $search: search };
    if (priceType) query.priceType = priceType;
    if (category) query.category = category;
    if (tags) query.tags = { $in: tags.split(",").map((t) => t.trim()) };

    const total = await Artifact.countDocuments(query);

    let sortQuery = { createdAt: -1 };
    if (sortBy === "popular")
      sortQuery = { downloadsCount: -1, viewsCount: -1 };
    else if (sortBy === "trending") sortQuery = { score: -1 };

    let artifacts;
    if (sortBy === "random") {
      artifacts = await Artifact.aggregate([
        { $match: query },
        { $sample: { size: limit } },
      ]);
    } else {
      artifacts = await Artifact.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate("comments", "feedbackType")
        .lean();
    }

    // Batch fetch users for artifacts
    const userIds = [...new Set(artifacts.map(t => t.user?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name profilePicture avatar email')
      .lean();
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    // Add likeCount and isLiked for each artifact
    const authUserId = req.user?._id?.toString() || req.user?.id?.toString();
    const visitorId = req.body?.visitorId || req.query?.visitorId;
    const uniqueId = authUserId || visitorId;

    // 🚀 OPTIMIZED: Use Set for O(1) isLiked check
    const likedSet = new Set(artifacts.flatMap(a => (a.likedBy || []).map(id => id.toString())));
    
    artifacts = artifacts.map(artifact => ({
      ...artifact,
      user: userMap[artifact.user?.toString()] || null,
      likes: artifact.likeCount || 0,
      isLiked: uniqueId ? (artifact.likedBy || []).map(id => id.toString()).includes(uniqueId) : false,
    }));

    return res.status(200).json({
      success: true,
      data: artifacts,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get Artifacts Error: ", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong. Please try again later.",
        error: err.message,
      });
  }
});

/* ------------------ GET ARTIFACT BY ID ------------------ */
export const getArtifactById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const artifact = await Artifact.findById(id).lean();
    if (!artifact || !artifact.isActive)
      return res
        .status(404)
        .json({ success: false, message: "Artifact not found." });

    // Fetch user separately
    if (artifact.user) {
      const user = await User.findById(artifact.user)
        .select('name email profilePicture avatar')
        .lean();
      artifact.user = user;
    }

    return res.status(200).json({ success: true, data: artifact });
  } catch (err) {
    logger.error("Get Artifact By Id Error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------ USER ARTIFACTS ------------------ */
export const getUserArtifacts = asyncHandler(async (req, res) => {
  try {
    const artifacts = await Artifact.find({
      user: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: artifacts });
  } catch (err) {
    logger.error("Get User Artifacts Error: ", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong. Please try again later.",
        error: err.message,
      });
  }
});

/* ------------------ DELETE ARTIFACT ------------------ */
export const deleteArtifact = asyncHandler(async (req, res) => {
  try {
    const artifact = await Artifact.findById(req.params.id);
    if (!artifact || !artifact.isActive)
      return res
        .status(404)
        .json({ success: false, message: "Artifact not found." });

    if (
      artifact.user?.toString() !== req.user._id.toString() &&
      !req.user.isSuperAdmin &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    artifact.isActive = false;
    await artifact.addAuditLog(
      "Artifact soft deleted",
      req.ip,
      req.headers["user-agent"],
      req.user._id
    );
    await artifact.save();

    return res
      .status(200)
      .json({ success: true, message: "Artifact deleted successfully." });
  } catch (err) {
    logger.error("Delete Artifact Error: ", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong. Please try again later.",
        error: err.message,
      });
  }
});

export const incrementView = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const artifact = await Artifact.findById(id).select("_id isActive");
  if (!artifact || !artifact.isActive) {
    return res
      .status(404)
      .json({ success: false, message: "Artifact not found." });
  }

  const userId = req.user?._id?.toString() || null;
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  const actor = userId || ip;
  
  // Get country from IP
  const geoip = await import("geoip-lite");
  const geo = geoip.default.lookup(ip);
  const country = geo ? geo.country : "Unknown";

  const cooldownKey = `views:cooldown:${id}:${actor}`;

  const set = await redis.set(
    cooldownKey,
    "1",
    "NX",
    "EX",
    VIEW_COOLDOWN_SECONDS
  );
  if (!set) {
    return res
      .status(200)
      .json({ success: true, counted: false, message: "Cooldown active" });
  }

  const countKey = `views:count:${id}`;
  const existingData = await redis.get(countKey);
  
  let viewData = existingData ? JSON.parse(existingData) : { count: 0, viewers: [] };
  viewData.count += 1;
  viewData.viewers.push({
    userId,
    ip,
    country,
    userAgent,
    timestamp: new Date().toISOString()
  });

  await redis.set(countKey, JSON.stringify(viewData), "EX", 300);
  await redis.zincrby(TRENDING_ZSET, 1, id);

  return res.status(200).json({ success: true, counted: true });
});


/* ------------------ INCREMENT DOWNLOAD ------------------ */
export const incrementDownload = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const artifact = await Artifact.findById(id).select("_id isActive");
  if (!artifact || !artifact.isActive)
    return res
      .status(404)
      .json({ success: false, message: "Artifact not found." });

  const actor =
    req.user?._id?.toString() ||
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress;
  const cooldownKey = `downloads:ip:${id}:${actor}`;
  const set = await redis.set(
    cooldownKey,
    "1",
    "NX",
    "EX",
    DOWNLOAD_COOLDOWN_SECONDS
  );

  if (!set)
    return res
      .status(200)
      .json({ success: true, counted: false, message: "Cooldown active" });

  const deltaKey = `downloads:delta:${id}`;
  const pipeline = redis.pipeline();
  pipeline.incr(deltaKey);
  pipeline.zincrby(POPULAR_ZSET, 3, id);
  const results = await pipeline.exec();
  const delta = parseInt(results[0][1], 10);

  if (delta >= 10)
    await rankingQueue.add(
      "flush-and-rank",
      { artifactId: id },
      { removeOnComplete: true, removeOnFail: true }
    );

  return res.status(200).json({ success: true, counted: true });
});




// -----------------------------
// Increment Impressions Controller
// -----------------------------
export const incrementImpression = asyncHandler(async (req, res) => {
  const { artifactIds } = req.body;
  if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid artifactIds",
    });
  }

  const pipeline = redis.pipeline();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (const id of artifactIds) {
    // Actor identification
    const actor =
      req.user?._id?.toString() ||
      req.ip ||
      req.headers["x-forwarded-for"] ||
      "anon";

    const cooldownKey = `impressions:artifact:${id}:actor:${actor}`;

    // Set NX EX for cooldown
    const set = await redis.set(cooldownKey, "1", "NX", "EX", IMPRESSION_COOLDOWN_SECONDS);
    if (!set) {
      continue; // skip this artifact
    }

    // Increment daily impression counter
    pipeline.incr(`impressions:artifact:${id}:day:${today}`);
    pipeline.expire(`impressions:artifact:${id}:day:${today}`, 86400 * 2);

    // Increment delta for flushCraftsman
    pipeline.incr(`impressions:delta:${id}`);

    // Quick trending leaderboard update
    pipeline.zincrby(TRENDING_ZSET, 1, id);
  }

  await pipeline.exec();

  return res.json({ success: true, counted: true });
});






/* ------------------ TRENDING & POPULAR ------------------ */
export const getTrendingArtifacts = asyncHandler(async (req, res) => {
  const TOPN = parseInt(req.query.limit || "10", 10);
  let ids = await redis.zrevrange("artifacts:trending:auth", 0, TOPN - 1);
  if (!ids || ids.length === 0)
    ids = await redis.zrevrange(TRENDING_ZSET, 0, TOPN - 1);

  if (ids && ids.length) {
    const docs = await Artifact.find({
      _id: { $in: ids },
      isActive: true,
    })
      .lean()
      .populate("user", "name email")
      .populate("comments", "feedbackType");
    const map = new Map(docs.map((d) => [d._id.toString(), d]));
    const ordered = ids.map((id) => map.get(id)).filter(Boolean);
    return res.status(200).json({ success: true, data: ordered });
  }

  const artifacts = await Artifact.find({
    trending: true,
    isActive: true,
  })
    .sort({ trendingScore: -1 })
    .limit(TOPN)
    .lean()
    .populate("user", "name email")
    .populate("comments", "feedbackType");
  return res.status(200).json({ success: true, data: artifacts });
});

export const getPopularArtifacts = asyncHandler(async (req, res) => {
  const TOPN = parseInt(req.query.limit || "10", 10);
  let ids = await redis.zrevrange("artifacts:popular:auth", 0, TOPN - 1);
  if (!ids || ids.length === 0)
    ids = await redis.zrevrange(POPULAR_ZSET, 0, TOPN - 1);

  if (ids && ids.length) {
    const docs = await Artifact.find({
      _id: { $in: ids },
      isActive: true,
    })
      .lean()
      .populate("user", "name email")
      .populate("comments", "feedbackType");
    const map = new Map(docs.map((d) => [d._id.toString(), d]));
    const ordered = ids.map((id) => map.get(id)).filter(Boolean);
    return res.status(200).json({ success: true, data: ordered });
  }

  const artifacts = await Artifact.find({ popular: true, isActive: true })
    .sort({ popularityScore: -1 })
    .limit(TOPN)
    .lean()
    .populate("user", "name email")
    .populate("comments", "feedbackType");
  return res.status(200).json({ success: true, data: artifacts });
});

/* ------------------ EDITORS CHOICE ------------------ */
export const getEditorsChoiceArtifacts = asyncHandler(async (req, res) => {
  try {
    const cacheKey = "artifacts:editors";
    const cached = await redis.get(cacheKey);
    if (cached)
      return res.status(200).json({ success: true, data: JSON.parse(cached) });

    const artifacts = await Artifact.find({
      editorsChoice: true,
      isActive: true,
    })
      .limit(10)
      .populate("user", "name email")
      .populate("comments", "feedbackType");
    await redis.set(cacheKey, JSON.stringify(artifacts), "EX", CACHE_TTL);

    return res.status(200).json({ success: true, data: artifacts });
  } catch (err) {
    logger.error("Get Editors Choice Artifacts Error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------ ARTIFACT COUNT ------------------ */
export const getArtifactCount = asyncHandler(async (req, res) => {
  try {
    const { status, isActive } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const total = await Artifact.countDocuments(filter);
    return res.status(200).json({ success: true, total });
  } catch (err) {
    logger.error("Get Artifact Count Error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------ FETCH AND SYNC CODEPEN ------------------ */
export const fetchAndSyncCodepen = asyncHandler(async (req, res) => {
  try {
    const { username } = req.params;
    if (!username)
      return res
        .status(400)
        .json({ success: false, message: "Missing username" });

    const url = `https://cpv2api.com/pens/public/${encodeURIComponent(
      username
    )}`;
    const apiRes = await axios.get(url, { timeout: 15000 });
    const pens = apiRes.data?.data || [];
    const results = [];

    for (const pen of pens) {
      try {
        const doc = await Artifact.upsertFromCodepen(pen);
        results.push({ id: doc._id, slugHash: doc.slugHash, title: doc.title });
      } catch (innerErr) {
        logger.warn(
          "Pen upsert failed for",
          pen.slug_hash || pen.id,
          innerErr.message
        );
      }
    }

    return res
      .status(200)
      .json({ success: true, count: results.length, items: results });
  } catch (err) {
    logger.error("fetchAndSyncCodepen Error:", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch from CodePen",
        error: err.message,
      });
  }
});

/* ------------------ LIKE ARTIFACT (Craftsman-based) ------------------ */
export const likeArtifact = asyncHandler(async (req, res) => {
    try {
        const { artifactId } = req.params;
        const userId = req.user._id || req.user.id;
        
        const artifact = await Artifact.findById(artifactId).select('_id likedBy likeCount');
        if (!artifact) return res.status(404).json({ success: false, message: "Artifact not found" });

        const isLiked = artifact.likedBy.some(id => id.toString() === userId.toString());
        const action = isLiked ? "unlike" : "like";

        // Optimistic Response
        const newLikeCount = isLiked ? Math.max(0, (artifact.likeCount || 0) - 1) : (artifact.likeCount || 0) + 1;

        // Add to Queue
        await postLikeQueue.add("post-like", {
            postId: artifact._id.toString(),
            userId: userId.toString(),
            action: action,
            itemType: "artifact"
        }, {
            removeOnComplete: true,
            attempts: 3
        });

        res.status(200).json({ success: true, likeCount: newLikeCount, isLiked: !isLiked, queued: true });
    } catch (error) {
        logger.error("LIKE ARTIFACT ERROR", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ------------------ ADD COMMENT TO ARTIFACT (Craftsman-based) ------------------ */
export const addArtifactComment = asyncHandler(async (req, res) => {
    try {
        const { artifactId } = req.params;
        const { content, feedbackType = 'comment' } = req.body;
        const userId = req.user._id || req.user.id;

        if (!content) return res.status(400).json({ success: false, message: "Content required" });

        const artifact = await Artifact.findById(artifactId);
        if (!artifact) return res.status(404).json({ success: false, message: "Artifact not found" });

        // Create comment synchronously for immediate response
        const comment = await Comment.create({
            content,
            artifact: artifact._id,
            author: userId,
            feedbackType
        });

        // Add to Queue for background processing (updating artifact's comment array)
        await postCommentQueue.add("post-comment", {
            postId: artifact._id.toString(),
            commentId: comment._id.toString(),
            itemType: "artifact"
        }, {
            removeOnComplete: true,
            attempts: 3
        });
        
        // Populate author for immediate return
        await comment.populate("author", "name username profilePicture avatar");

        res.status(201).json({ success: true, comment, queued: true });
    } catch (error) {
        logger.error("ADD ARTIFACT COMMENT ERROR", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ------------------ GET ARTIFACT COMMENTS ------------------ */
export const getArtifactComments = asyncHandler(async (req, res) => {
    try {
         const { artifactId } = req.params;
         const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || 50;
         const skip = (page - 1) * limit;

         const artifact = await Artifact.findById(artifactId).select("_id");
         if (!artifact) return res.status(404).json({ success: false, message: "Artifact not found" });

         const comments = await Comment.find({ artifact: artifact._id })
            .populate("author", "name username profilePicture avatar")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

         const total = await Comment.countDocuments({ artifact: artifact._id });

         res.status(200).json({ 
             success: true, 
             data: comments,
             pagination: {
                 total,
                 page,
                 hasMore: skip + comments.length < total
             }
         });
    } catch (err) {
        logger.error("GET ARTIFACT COMMENTS ERROR", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ------------------ DELETE ARTIFACT COMMENT ------------------ */
export const deleteArtifactComment = asyncHandler(async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id || req.user.id;

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        // Check ownership
        if (comment.author.toString() !== userId.toString()) {
             return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await Comment.findByIdAndDelete(commentId);
        // Also remove from Artifact
        if (comment.artifact) {
            await Artifact.findByIdAndUpdate(comment.artifact, { $pull: { comments: commentId } });
        }

        res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (err) {
        logger.error("DELETE ARTIFACT COMMENT ERROR", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ------------------ SHARE ARTIFACT ------------------ */
export const shareArtifact = asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const { platform } = req.body;
    const userId = req.user?._id || null;

    // Check if artifact exists 
    const artifact = await Artifact.findById(id).select('_id');
    if (!artifact) {
        return res.status(404).json({ success: false, message: "Artifact not found" });
    }

    // Add to Queue
    await shareQueue.add("share-artifact", {
        itemId: id,
        type: "artifact",
        userId,
        platform
    }, {
        removeOnComplete: true,
        attempts: 3
    });

    res.status(200).json({ success: true, queued: true });
});

/* ------------------ BUY ARTIFACT (Token Native) ------------------ */
export const buyArtifact = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const artifact = await Artifact.findById(id).populate("user").session(session);
        if (!artifact) {
            throw new Error("Artifact not found");
        }

        if (artifact.priceType === "free") {
            throw new Error("This artifact is free. You can download it directly.");
        }

        // Check if already purchased (O(log n) with index)
        const alreadyPurchased = await Artifact.exists({ _id: id, purchasedBy: userId }).session(session);
        if (alreadyPurchased) {
            await session.abortTransaction();
            session.endSession();
            return res.status(200).json({ success: true, message: "You already own this artifact." });
        }

        const user = await User.findById(userId).session(session);
        const price = artifact.discountedPrice || artifact.price;

        if (user.walletBalance < price) {
            throw new Error(`Insufficient balance. You need ${price} TKNS but have ${user.walletBalance.toFixed(2)} TKNS.`);
        }

        // 1. Deduct from User
        user.walletBalance -= price;
        await user.save({ session });

        // 2. Add to Craftsman (if craftsman exists)
        if (artifact.user) {
            const craftsman = await User.findById(artifact.user._id).session(session);
            if (craftsman) {
                craftsman.walletBalance += price;
                craftsman.totalEarnings = (craftsman.totalEarnings || 0) + price;
                await craftsman.save({ session });
            }
        }

        // 3. Mark as Purchased
        artifact.purchasedBy.push(userId);
        artifact.salesCount += 1;
        await artifact.save({ session });

        // 4. Record Transaction
        await Transaction.create([{
            fromUser: userId,
            toUser: artifact.user?._id,
            amount: price,
            type: "payout",
            status: "completed",
            description: `Purchased Artifact: ${artifact.title}`,
            metadata: { artifactId: id }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ 
            success: true, 
            message: "Artifact purchased successfully!",
            data: { walletBalance: user.walletBalance }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        logger.error("BUY ARTIFACT ERROR", error);
        res.status(error.message.includes("not found") ? 404 : 400).json({ 
            success: false, 
            message: error.message || "Purchase failed" 
        });
    }
});

/* ------------------ UPDATE ARTIFACT (Edit) ------------------ */
export const updateArtifact = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let artifact = await Artifact.findById(id);

    if (!artifact) {
        return res.status(404).json({ success: false, message: "Artifact not found" });
    }

    // Check ownership
    if (artifact.user?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const updates = { ...req.body };
    
    // Handle tags and tech arrays
    if (updates.tags) updates.tags = updates.tags.split(",").map(t => t.trim());
    if (updates.tech) {
        updates.tech = (Array.isArray(updates.tech) ? updates.tech : updates.tech.split(",")).map(t => t.trim());
    }

    // Handle file updates if provided
    if (req.files?.previewFile?.[0]) {
        const previewFile = req.files.previewFile[0];
        const uploadedPreview = await cloudinary.uploader.upload(previewFile.path, {
            folder: "artifact_previews",
            resource_type: previewFile.mimetype.startsWith("video/") ? "video" : "image",
        });
        updates.previewFile = uploadedPreview.secure_url;
        if (fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    }

    if (req.files?.devlogFile?.[0]) {
        const devlogFile = req.files.devlogFile[0];
        const uploadedDevlog = await cloudinary.uploader.upload(devlogFile.path, {
            folder: "artifact_devlogs",
            resource_type: "raw",
            public_id: `artifact_${Date.now()}_${devlogFile.originalname.replace(/\.[^/.]+$/, "")}`,
        });
        updates.devlogFile = uploadedDevlog.secure_url;
        updates.fileSize = devlogFile.size;
        updates.fileType = devlogFile.mimetype;
        if (fs.existsSync(devlogFile.path)) fs.unlinkSync(devlogFile.path);
    }

    artifact = await Artifact.findByIdAndUpdate(id, updates, { new: true });
    await artifact.addAuditLog("Artifact updated (Edit)", req.ip, req.headers["user-agent"], req.user._id);

    res.status(200).json({ success: true, message: "Artifact updated successfully", data: artifact });
});

/* ------------------ UPGRADE ARTIFACT (Versioning) ------------------ */
export const upgradeArtifact = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { versionName, changelog } = req.body;
    let artifact = await Artifact.findById(id);

    if (!artifact) {
        return res.status(404).json({ success: false, message: "Artifact not found" });
    }

    if (!versionName) {
        return res.status(400).json({ success: false, message: "Version name is required for upgrade" });
    }

    // Check ownership
    if (artifact.user?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Save current version to history
    artifact.versions.push({
        version: artifact.currentVersion,
        changelog: "Previous version",
        previewFile: artifact.previewFile,
        devlogFile: artifact.devlogFile,
        updatedAt: artifact.updatedAt
    });

    const updates = { ...req.body };
    updates.currentVersion = versionName;
    
    // Handle tags and tech arrays
    if (updates.tags) updates.tags = updates.tags.split(",").map(t => t.trim());
    if (updates.tech) {
        updates.tech = (Array.isArray(updates.tech) ? updates.tech : updates.tech.split(",")).map(t => t.trim());
    }

    // Files are REQUIRED for upgrade to ensure a new version actually has content
    if (!req.files?.previewFile?.[0] || !req.files?.devlogFile?.[0]) {
        return res.status(400).json({ success: false, message: "New preview and source files are required for a version upgrade" });
    }

    // Upload new files
    const previewFile = req.files.previewFile[0];
    const uploadedPreview = await cloudinary.uploader.upload(previewFile.path, {
        folder: "artifact_previews",
        resource_type: previewFile.mimetype.startsWith("video/") ? "video" : "image",
    });
    updates.previewFile = uploadedPreview.secure_url;
    if (fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);

    const devlogFile = req.files.devlogFile[0];
    const uploadedDevlog = await cloudinary.uploader.upload(devlogFile.path, {
        folder: "artifact_devlogs",
        resource_type: "raw",
        public_id: `artifact_${Date.now()}_v${versionName.replace(/\./g, '_')}_${devlogFile.originalname.replace(/\.[^/.]+$/, "")}`,
    });
    updates.devlogFile = uploadedDevlog.secure_url;
    updates.fileSize = devlogFile.size;
    updates.fileType = devlogFile.mimetype;
    if (fs.existsSync(devlogFile.path)) fs.unlinkSync(devlogFile.path);

    // Actually, just using save is cleaner after manual modification of array
    artifact.set(updates);
    await artifact.save();

    await artifact.addAuditLog(`Artifact upgraded to ${versionName}`, req.ip, req.headers["user-agent"], req.user._id);

    res.status(200).json({ success: true, message: `Artifact upgraded to ${versionName}`, data: artifact });
});

