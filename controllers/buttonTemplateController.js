// controllers/buttonTemplateController.js
import asyncHandler from "express-async-handler";
import axios from "axios";
import ButtonTemplate from "../models/Template.model.js";
import logger from "../utils/logger.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";
import { scanQueue } from "../queues/scanQueue.js";
import { rankingQueue } from "../queues/index.js";
import redis from "../utils/redisClient.js"; 
import { CACHE_TTL } from "../config/constants.js"; 
import { shareQueue } from "../queues/shareQueue.js";

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

const TRENDING_ZSET = "templates:trending:zset";
const POPULAR_ZSET = "templates:popular:zset";
const FLUSH_THRESHOLD = 50;

/* ------------------ CREATE TEMPLATE ------------------ */
// ❌ DO NOT CHANGE createTemplate
export const createTemplate = asyncHandler(async (req, res) => {

  if (!req.files?.previewFile?.[0] || !req.files?.projectFile?.[0]) {
    return res.status(400).json({
      success: false,
      errors: ["Preview file and Project file are required"],
    });
  }

  const previewFile = req.files.previewFile[0];
  const projectFile = req.files.projectFile[0];

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
    folder: "template_previews",
    resource_type: previewFile.mimetype.startsWith("video/")
      ? "video"
      : "image",
  });
  if (fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);

  let template = await ButtonTemplate.create({
    user: req.user?._id,
    ...req.body,
    tags: req.body.tags ? req.body.tags.split(",").map((t) => t.trim()) : [],
    tech: req.body.tech ? (Array.isArray(req.body.tech) ? req.body.tech : req.body.tech.split(",")).map((t) => t.trim()) : [],
    price: req.body.priceType === "paid" ? req.body.price : 0,
    cardShape: req.body.cardShape || "square-medium",
    previewFile: uploadedPreview.secure_url,
    projectFile: projectFile.path,
    fileType: projectFile.mimetype,
    fileSize: projectFile.size,
    sourceType: "user",
    status: "pending",
  });

  template = await ButtonTemplate.findById(template._id);
  await template.addAuditLog(
    "Template uploaded",
    req.ip,
    req.headers["user-agent"],
    req.user?._id
  );
  await template.updateScores();

  const fileBuffer = fs.readFileSync(projectFile.path);

  if (fs.existsSync(projectFile.path)) fs.unlinkSync(projectFile.path);

  const fileBufferBase64 = fileBuffer.toString("base64");

  await scanQueue.add("scan-project", {
    templateId: template._id,
    originalName: projectFile.originalname,
    userId: req.user?._id,
    fileBuffer: fileBufferBase64,
  });

  return res.status(201).json({
    success: true,
    message:
      "Template uploaded successfully. Preview hosted on Cloudinary. Project file queued for scanning & upload.",
    data: template,
  });
});

/* ------------------ GET TEMPLATES ------------------ */
export const getTemplates = asyncHandler(async (req, res) => {
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
    } = req.query;
    const query = { isActive: true };

    if (search) query.$text = { $search: search };
    if (priceType) query.priceType = priceType;
    if (category) query.category = category;
    if (tags) query.tags = { $in: tags.split(",").map((t) => t.trim()) };

    const total = await ButtonTemplate.countDocuments(query);

    let sortQuery = { createdAt: -1 };
    if (sortBy === "popular")
      sortQuery = { downloadsCount: -1, viewsCount: -1 };
    else if (sortBy === "trending") sortQuery = { score: -1 };

    let templates;
    if (sortBy === "random") {
      templates = await ButtonTemplate.aggregate([
        { $match: query },
        { $sample: { size: limit } },
      ]);
    } else {
      templates = await ButtonTemplate.find(query)
        .populate("user", "name email profilePicture")
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // Add likeCount and isLiked for each template
    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    const visitorId = req.body?.visitorId || req.query?.visitorId;
    const uniqueId = userId || visitorId;

    templates = templates.map(template => ({
      ...template,
      likes: template.likeCount || 0,
      isLiked: uniqueId ? (template.likedBy || []).includes(uniqueId) : false,
    }));

    return res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Get Templates Error: ", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong. Please try again later.",
        error: err.message,
      });
  }
});

/* ------------------ GET TEMPLATE BY ID ------------------ */
export const getTemplateById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const template = await ButtonTemplate.findById(id).populate(
      "user",
      "name email profilePicture"
    );
    if (!template || !template.isActive)
      return res
        .status(404)
        .json({ success: false, message: "Template not found." });

    return res.status(200).json({ success: true, data: template });
  } catch (err) {
    logger.error("Get Template By Id Error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------ USER TEMPLATES ------------------ */
export const getUserTemplates = asyncHandler(async (req, res) => {
  try {
    const templates = await ButtonTemplate.find({
      user: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: templates });
  } catch (err) {
    logger.error("Get User Templates Error: ", err.stack || err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong. Please try again later.",
        error: err.message,
      });
  }
});

/* ------------------ DELETE TEMPLATE ------------------ */
export const deleteTemplate = asyncHandler(async (req, res) => {
  try {
    const template = await ButtonTemplate.findById(req.params.id);
    if (!template || !template.isActive)
      return res
        .status(404)
        .json({ success: false, message: "Template not found." });

    if (
      template.user?.toString() !== req.user._id.toString() &&
      !req.user.isSuperAdmin &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    template.isActive = false;
    await template.addAuditLog(
      "Template soft deleted",
      req.ip,
      req.headers["user-agent"],
      req.user._id
    );
    await template.save();

    return res
      .status(200)
      .json({ success: true, message: "Template deleted successfully." });
  } catch (err) {
    logger.error("Delete Template Error: ", err.stack || err);
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

  const template = await ButtonTemplate.findById(id).select("_id isActive");
  if (!template || !template.isActive) {
    return res
      .status(404)
      .json({ success: false, message: "Template not found." });
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
  const template = await ButtonTemplate.findById(id).select("_id isActive");
  if (!template || !template.isActive)
    return res
      .status(404)
      .json({ success: false, message: "Template not found." });

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
      { templateId: id },
      { removeOnComplete: true, removeOnFail: true }
    );

  return res.status(200).json({ success: true, counted: true });
});




// -----------------------------
// Increment Impressions Controller
// -----------------------------
export const incrementImpression = asyncHandler(async (req, res) => {
  const { templateIds } = req.body;
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid templateIds",
    });
  }

  const pipeline = redis.pipeline();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (const id of templateIds) {
    // Actor identification
    const actor =
      req.user?._id?.toString() ||
      req.ip ||
      req.headers["x-forwarded-for"] ||
      "anon";

    const cooldownKey = `impressions:template:${id}:actor:${actor}`;

    // Set NX EX for cooldown
    const set = await redis.set(cooldownKey, "1", "NX", "EX", IMPRESSION_COOLDOWN_SECONDS);
    if (!set) {
      continue; // skip this template
    }

    // Increment daily impression counter
    pipeline.incr(`impressions:template:${id}:day:${today}`);
    pipeline.expire(`impressions:template:${id}:day:${today}`, 86400 * 2);

    // Increment delta for flushWorker
    pipeline.incr(`impressions:delta:${id}`);

    // Quick trending leaderboard update
    pipeline.zincrby(TRENDING_ZSET, 1, id);
  }

  await pipeline.exec();

  return res.json({ success: true, counted: true });
});






/* ------------------ TRENDING & POPULAR ------------------ */
export const getTrendingTemplates = asyncHandler(async (req, res) => {
  const TOPN = parseInt(req.query.limit || "10", 10);
  let ids = await redis.zrevrange("templates:trending:auth", 0, TOPN - 1);
  if (!ids || ids.length === 0)
    ids = await redis.zrevrange(TRENDING_ZSET, 0, TOPN - 1);

  if (ids && ids.length) {
    const docs = await ButtonTemplate.find({
      _id: { $in: ids },
      isActive: true,
    })
      .lean()
      .populate("user", "name email");
    const map = new Map(docs.map((d) => [d._id.toString(), d]));
    const ordered = ids.map((id) => map.get(id)).filter(Boolean);
    return res.status(200).json({ success: true, data: ordered });
  }

  const templates = await ButtonTemplate.find({
    trending: true,
    isActive: true,
  })
    .sort({ trendingScore: -1 })
    .limit(TOPN)
    .lean()
    .populate("user", "name email");
  return res.status(200).json({ success: true, data: templates });
});

export const getPopularTemplates = asyncHandler(async (req, res) => {
  const TOPN = parseInt(req.query.limit || "10", 10);
  let ids = await redis.zrevrange("templates:popular:auth", 0, TOPN - 1);
  if (!ids || ids.length === 0)
    ids = await redis.zrevrange(POPULAR_ZSET, 0, TOPN - 1);

  if (ids && ids.length) {
    const docs = await ButtonTemplate.find({
      _id: { $in: ids },
      isActive: true,
    })
      .lean()
      .populate("user", "name email");
    const map = new Map(docs.map((d) => [d._id.toString(), d]));
    const ordered = ids.map((id) => map.get(id)).filter(Boolean);
    return res.status(200).json({ success: true, data: ordered });
  }

  const templates = await ButtonTemplate.find({ popular: true, isActive: true })
    .sort({ popularityScore: -1 })
    .limit(TOPN)
    .lean()
    .populate("user", "name email");
  return res.status(200).json({ success: true, data: templates });
});

/* ------------------ EDITORS CHOICE ------------------ */
export const getEditorsChoiceTemplates = asyncHandler(async (req, res) => {
  try {
    const cacheKey = "templates:editors";
    const cached = await redis.get(cacheKey);
    if (cached)
      return res.status(200).json({ success: true, data: JSON.parse(cached) });

    const templates = await ButtonTemplate.find({
      editorsChoice: true,
      isActive: true,
    })
      .limit(10)
      .populate("user", "name email");
    await redis.set(cacheKey, JSON.stringify(templates), "EX", CACHE_TTL);

    return res.status(200).json({ success: true, data: templates });
  } catch (err) {
    logger.error("Get Editors Choice Templates Error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------ TEMPLATE COUNT ------------------ */
export const getTemplateCount = asyncHandler(async (req, res) => {
  try {
    const { status, isActive } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const total = await ButtonTemplate.countDocuments(filter);
    return res.status(200).json({ success: true, total });
  } catch (err) {
    logger.error("Get Template Count Error:", err.stack || err);
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
        const doc = await ButtonTemplate.upsertFromCodepen(pen);
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

/* ------------------ SHARE TEMPLATE ------------------ */
export const shareTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params; 
    const { platform } = req.body;
    const userId = req.user?._id || null;

    // Check if template exists 
    const template = await ButtonTemplate.findById(id).select('_id');
    if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
    }

    // Add to Queue
    await shareQueue.add("share-template", {
        itemId: id,
        type: "template",
        userId,
        platform
    }, {
        removeOnComplete: true,
        attempts: 3
    });

    res.status(200).json({ success: true, queued: true });
});
