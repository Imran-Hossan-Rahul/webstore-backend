import Codex from "../models/Codex.model.js";
import User from "../models/User.model.js";
import Comment from "../models/Comment.model.js";
import geoip from "geoip-lite";
import redis from "../config/redis.js";

/* ----------------------
   Create Codex
------------------------- */
export const createCodex = async (req, res) => {
  try {
    const { title, content, tags, category, coverImage, cardShape, subtitle, excerpt, proTips, keyTakeaways, seoTitle, seoDescription, focusKeywords } = req.body;



    if (!title || !content) {
      return res.status(400).json({ message: "Title & content are required" });
    }

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    // Calculate read time from content word count (200 wpm)
    const wordCount = content ? content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const readTime = `${readMinutes} min read`;

    const codex = await Codex.create({
      title,
      content,
      tags,
      category,
      coverImage,
      cardShape,
      subtitle,
      excerpt,
      proTips,
      keyTakeaways,
      seoTitle,
      seoDescription,
      focusKeywords,
      readTime,
      author: userId,
      isPublished: false,
    });



    res.status(201).json({
      message: "Codex created successfully",
      codex,
    });
  } catch (error) {
    console.error("CREATE CODEX ERROR:", error);
    try { (await import('fs')).writeFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/create_error.txt', error.stack || error.toString()); } catch(e){}
    res.status(500).json({ message: "Server error" });
  }
};

import mongoose from "mongoose";

/* ----------------------
   Get All Codex (Simplified - No Cache)
------------------------- */
export const getAllCodex = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build Match Criteria dynamically
    const matchCriteria = {
      isDeleted: false
    };

    if (req.query.author) {
      matchCriteria.author = new mongoose.Types.ObjectId(req.query.author);
      
      // If it's NOT the owner requesting, only show published ones
      const isOwner = req.user && (req.user._id.toString() === req.query.author.toString());
      if (!isOwner) {
        matchCriteria.isPublished = true;
      }
    } else {
      // Default view: only published
      matchCriteria.isPublished = true;
    }

    // SMART QUERY: Use Aggregation to filter out huge Base64 images and get data + count in one trip
    const [result] = await Codex.aggregate([
      { $match: matchCriteria },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                title: 1,
                slug: 1,
                cardShape: 1,
                tags: 1,
                category: 1,
                views: 1,
                likesCount: 1,
                createdAt: 1,
                author: 1,
                subtitle: 1,
                excerpt: 1,
                proTips: 1,
                keyTakeaways: 1,
                seoTitle: 1,
                seoDescription: 1,
                focusKeywords: 1,
                readTime: 1,
                comments: 1,
                // Only return coverImage if it's short (likely a URL), otherwise null
                coverImage: {
                  $cond: {
                    if: { $gt: [{ $strLenCP: { $ifNull: ["$coverImage", ""] } }, 500] },
                    then: null, // Too long (Base64), don't send
                    else: "$coverImage" // Short enough (URL), send it
                  }
                }
              }
            },
            {
              $lookup: {
                from: "comments",
                localField: "comments",
                foreignField: "_id",
                pipeline: [
                  { $project: { feedbackType: 1 } }
                ],
                as: "comments"
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "authorDetails"
              }
            },
            {
              $lookup: {
                from: "craftsmanprofiles",
                localField: "author",
                foreignField: "userId",
                as: "craftsmanProfile"
              }
            },
            {
              $addFields: {
                author: {
                  $let: {
                    vars: {
                      user: { $arrayElemAt: ["$authorDetails", 0] },
                      cp: { $arrayElemAt: ["$craftsmanProfile", 0] }
                    },
                    in: {
                      $cond: {
                        if: { $gt: [{ $size: "$authorDetails" }, 0] },
                        then: {
                          $mergeObjects: [
                            "$$user",
                            { profilePicture: { $ifNull: ["$$cp.profilePicture", "$$user.profilePicture"] } }
                          ]
                        },
                        else: null
                      }
                    }
                  }
                }
              }
            },
            {
              $project: {
                title: 1,
                slug: 1,
                cardShape: 1,
                tags: 1,
                category: 1,
                views: 1,
                likesCount: 1,
                createdAt: 1,
                coverImage: 1,
                subtitle: 1,
                excerpt: 1,
                proTips: 1,
                keyTakeaways: 1,
                seoTitle: 1,
                seoDescription: 1,
                focusKeywords: 1,
                readTime: 1,
                comments: 1,
                "author._id": 1,
                "author.name": 1,
                "author.email": 1,
                "author.avatar": 1,
                "author.profilePic": 1,
                excerpt: 1
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ]);

    const codex = result?.data || [];
    const totalCount = result?.totalCount?.[0]?.count || 0;

    const response = {
      success: true,
      codex,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCodex: totalCount,
        hasMore: skip + codex.length < totalCount
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("âŒ GET ALL CODEXS ERROR:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ----------------------
   Get Single Codex by Slug
------------------------- */
export const getSingleCodex = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Check Redis cache first
    const cacheKey = `codex:${slug}`;
    let cached = null;
    try {
      cached = await redis.get(cacheKey);
    } catch (err) {
      console.error("Redis get failed (non-fatal):", err.message);
    }
    
    if (cached) {
      const parsed = JSON.parse(cached);
      // If author is still an un-populated ObjectId string, it's a stale cache â€” bypass it.
      if (parsed && parsed.author && typeof parsed.author === 'object' && parsed.author._id) {
        return res.status(200).json(parsed);
      }
      // stale cache entry â€” fall through and re-fetch from DB
      try { await redis.del(cacheKey); } catch (e) { /* ignore */ }
    }

    // Fetch from database with optimized query
    const codex = await Codex.findOne({
      slug,
      isDeleted: false,
    })
    .populate("author", "name email profilePicture")
    .lean(); // Use lean() for better performance

    if (!codex) {
      return res.status(404).json({ message: "Codex not found" });
    }

    // Enrich author with CraftsmanProfile picture as a fallback
    // (User.profilePicture may be empty while CraftsmanProfile.profilePicture has the actual photo)
    if (codex.author && codex.author._id && !codex.author.profilePicture) {
      try {
        const CraftsmanProfile = (await import("../models/CraftsmanProfile.model.js")).default;
        const cp = await CraftsmanProfile.findOne({ userId: codex.author._id }).select("profilePicture").lean();
        if (cp?.profilePicture) {
          codex.author.profilePicture = cp.profilePicture;
        }
      } catch (e) { /* non-fatal */ }
    }
    
    // Cache for 5 minutes (300 seconds)
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(codex));
    } catch (err) {
      console.error("Redis setex failed (non-fatal):", err.message);
    }

    res.status(200).json(codex);
  } catch (error) {
    console.error("GET SINGLE CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get Codex Analytics
------------------------- */
export const getCodexAnalytics = async (req, res) => {
  try {
    const { slug } = req.params;
    const { range = '7d' } = req.query;
    const userId = req.user._id || req.user.id;

    // ðŸš€ FIX: Lightweight auth check â€” no full populate needed
    const codexMeta = await Codex.findOne({ slug, isDeleted: false })
      .select('_id author views likesCount comments sharesCount impressions')
      .lean();
    if (!codexMeta) return res.status(404).json({ message: "Codex not found" });
    if (codexMeta.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Time range config
    const now = new Date();
    const startTime = new Date();
    let dateFormat, interval;
    switch(range) {
      case '1h':  startTime.setHours(startTime.getHours() - 1); dateFormat = "%Y-%m-%dT%H:%M"; interval = 'minute'; break;
      case '24h': startTime.setHours(startTime.getHours() - 24); dateFormat = "%Y-%m-%dT%H:00"; interval = 'hour'; break;
      case '30d': startTime.setDate(startTime.getDate() - 30); dateFormat = "%Y-%m-%d"; interval = 'day'; break;
      default:    startTime.setDate(startTime.getDate() - 7);   dateFormat = "%Y-%m-%d"; interval = 'day';
    }

    // ðŸš€ ALL computation pushed to MongoDB â€” O(n) single pass per aggregation
    // No large document loaded into JS memory at all
    const [viewAgg, likeAgg, shareAgg, impressionAgg, commentCount, countryAgg] = await Promise.all([

      // 1. Views trend â€” server-side $unwind + $group (O(n) single pass)
      Codex.aggregate([
        { $match: { _id: codexMeta._id } },
        { $unwind: "$viewHistory" },
        { $unwind: "$viewHistory.viewers" },
        { $match: { "viewHistory.viewers.timestamp": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: "$viewHistory.viewers.timestamp" } },
            views: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]),

      // 2. Likes trend â€” O(n) on likeHistory array
      Codex.aggregate([
        { $match: { _id: codexMeta._id } },
        { $unwind: "$likeHistory" },
        { $match: { "likeHistory.timestamp": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: "$likeHistory.timestamp" } },
            likes: { $sum: 1 }
          }
        }
      ]),

      // 3. Shares trend
      Codex.aggregate([
        { $match: { _id: codexMeta._id } },
        { $unwind: "$shareHistory" },
        { $match: { "shareHistory.timestamp": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$shareHistory.timestamp" } },
            shares: { $sum: 1 }
          }
        }
      ]),

      // 4. Impressions trend (already grouped by day in schema)
      Codex.aggregate([
        { $match: { _id: codexMeta._id } },
        { $unwind: "$impressionHistory" },
        { $match: { "impressionHistory.date": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$impressionHistory.date" } },
            impressions: { $sum: "$impressionHistory.count" }
          }
        }
      ]),

      // 5. Comment count â€” O(log n) on createdAt index, no $in array needed
      Comment.countDocuments({ codex: codexMeta._id, createdAt: { $gte: startTime } }),

      // 6. Country distribution â€” server-side grouping
      Codex.aggregate([
        { $match: { _id: codexMeta._id } },
        { $unwind: "$viewHistory" },
        { $unwind: "$viewHistory.viewers" },
        { $match: { "viewHistory.viewers.timestamp": { $gte: startTime } } },
        {
          $group: {
            _id: { $ifNull: ["$viewHistory.viewers.country", "Unknown"] },
            value: { $sum: 1 }
          }
        },
        { $sort: { value: -1 } },
        { $limit: 10 },
        { $project: { name: "$_id", value: 1, _id: 0 } }
      ])
    ]);

    // ðŸš€ Merge trend buckets in O(B) where B = number of time buckets (max ~30 for 30d, ~60 for 1h)
    const buckets = new Map();
    const addBucket = (key) => { if (!buckets.has(key)) buckets.set(key, { date: key, views: 0, likes: 0, shares: 0, impressions: 0, comments: 0 }); };

    viewAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).views = r.views; });
    likeAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).likes = r.likes; });
    shareAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).shares = r.shares; });
    impressionAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).impressions = r.impressions; });

    const viewsTrend = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
    const periodViews = viewAgg.reduce((s, r) => s + r.views, 0);

    res.status(200).json({
      totalViews: codexMeta.views,
      totalLikes: codexMeta.likesCount,
      totalComments: codexMeta.comments?.length || 0,
      totalShares: codexMeta.sharesCount || 0,
      totalImpressions: codexMeta.impressions || 0,
      periodViews,
      periodComments: commentCount,
      viewsTrend,
      countryDistribution: countryAgg,
      // Age demographics require user population â€” kept lightweight (no populate)
      ageDistribution: []
    });

  } catch (error) {
    console.error("GET ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

import { postLikeQueue } from "../queues/postLikeQueue.js";

/* ----------------------
   Like Codex
------------------------- */
export const likeCodex = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user._id || req.user.id;
        
        // ðŸš€ FIX: O(log n) DB-level check via index instead of O(n) .some() array scan
        // Loads ONLY _id + likesCount â€” not the entire likes array
        const codex = await Codex.findOne({ slug, isDeleted: false }).select('_id likesCount').lean();
        if (!codex) return res.status(404).json({ message: "Codex not found" });

        // O(log n): MongoDB uses the array index to check existence â€” no JS iteration
        const isLiked = await Codex.exists({ _id: codex._id, likes: userId });
        const action = isLiked ? "unlike" : "like";

        // Optimistic Response
        const newLikesCount = isLiked ? Math.max(0, (codex.likesCount || 0) - 1) : (codex.likesCount || 0) + 1;

        // Add to Queue
        await postLikeQueue.add("post-like", {
            postId: codex._id.toString(),
            userId: userId,
            action: action,
            itemType: "codex"
        }, {
            removeOnComplete: true,
            attempts: 3
        });

        res.status(200).json({ success: true, likesCount: newLikesCount, isLiked: !isLiked, queued: true });
    } catch (error) {
        console.error("LIKE ERROR", error);
        res.status(500).json({ message: "Server error" });
    }
};


/* ----------------------
   Comments Controller
------------------------- */
export const addComment = async (req, res) => {
    try {
        const { slug } = req.params;
        const { content, feedbackType = 'comment' } = req.body;
        const userId = req.user._id || req.user.id;

        if (!content) return res.status(400).json({ message: "Content required" });

        const codex = await Codex.findOne({ slug, isDeleted: false });
        if (!codex) return res.status(404).json({ message: "Codex not found" });

        const comment = await Comment.create({
            content,
            codex: codex._id,
            author: userId,
            feedbackType
        });

        codex.comments.push(comment._id);
        await codex.save();
        
        // Populate author for immediate return
        await comment.populate("author", "fullname username profile_img");

        res.status(201).json({ success: true, comment });
    } catch (error) {
        console.error("ADD COMMENT ERROR", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getCodexComments = async (req, res) => {
    try {
         const { slug } = req.params;
         const codex = await Codex.findOne({ slug }).select("_id");
         if (!codex) return res.status(404).json({ message: "Codex not found" });

         const comments = await Comment.find({ codex: codex._id })
            .populate("author", "fullname username profile_img")
            .sort({ createdAt: -1 });

         res.status(200).json({ success: true, data: comments });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id || req.user.id;

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        // Check ownership
        if (comment.author.toString() !== userId.toString()) {
             // Allow codex owner to delete too? Optional. For now strict author.
             return res.status(403).json({ message: "Unauthorized" });
        }

        await Comment.findByIdAndDelete(commentId);
        // Also remove from Codex (optional but clean)
        await Codex.findByIdAndUpdate(comment.codex, { $pull: { comments: commentId } });

        res.status(200).json({ success: true, message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

/* ----------------------
   Get Codex for Editor (Drafts allowed)
------------------------- */
export const getCodexForEditor = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user._id || req.user.id; // From verifyAccessToken

    // Find codex by slug, allow deleted checking if needed, but definitely allow drafts
    const codex = await Codex.findOne({ slug, isDeleted: false })
      .populate("author", "name email avatar");

    if (!codex) {
      return res.status(404).json({ message: "Codex not found" });
    }

    // Check ownership
    // Convert to strings to ensure correct comparison
    if (codex.author._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not the author of this codex" });
    }


    // No caching here as we want fresh data for editing
    res.status(200).json(codex);
  } catch (error) {
    console.error("GET CODEX FOR EDITOR ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Track Codex View
------------------------- */
export const trackCodexView = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?._id || req.user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const geo = geoip.lookup(ip);
    const country = geo ? geo.country : "Unknown";

    const codex = await Codex.findOne({ slug, isDeleted: false, isPublished: true });
    if (!codex) return res.status(404).json({ message: "Codex not found" });

    const userIdentifier = userId || ip;
    const cooldownKey = `cooldown:view:${codex._id}:${userIdentifier}`;
    const redisKey = `views:codex:${codex._id}`;
    
    try {
      // Check cooldown
      const hasCooldown = await redis.get(cooldownKey);
      if (hasCooldown) {
        return res.status(200).json({ message: "View already counted (cooldown)", views: codex.views });
      }

      const existingData = await redis.get(redisKey);
      
      let viewData = existingData ? JSON.parse(existingData) : { count: 0, viewers: [] };
      viewData.count += 1;
      viewData.viewers.push({
        userId: userId || null,
        ip,
        country, // Add country tracking
        userAgent,
        timestamp: new Date(),
      });

      await redis.set(redisKey, JSON.stringify(viewData), 'EX', 300);
      
      // Set Cooldown (2 minutes = 120 seconds)
      await redis.set(cooldownKey, "1", "EX", 120);
    } catch (err) {
      console.error("Redis tracking failed (non-fatal):", err.message);
      // Fallback: we could immediately save to MongoDB, but for performance, we might just skip temporary tracking if Redis is down, or we can just ignore.
      // At least the API won't crash 500.
    }

    res.status(200).json({ message: "View tracked", views: codex.views + 1 });
  } catch (error) {
    console.error("TRACK CODEX VIEW ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Share Codex
------------------------- */
/* ----------------------
   Share Codex
------------------------- */
import { shareQueue } from "../queues/shareQueue.js";

export const shareCodex = async (req, res) => {
    try {
        const { slug } = req.params;
        const { platform } = req.body;
        const userId = req.user?._id || null;

        const codex = await Codex.findOne({ slug }).select('_id');
        if (!codex) return res.status(404).json({ message: "Codex not found" });

        // Add to Queue
        await shareQueue.add("share-codex", {
            itemId: codex._id,
            type: "codex",
            userId,
            platform
        }, {
            removeOnComplete: true,
            attempts: 3
        });
        
        res.status(200).json({ success: true, queued: true });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

/* ----------------------
   Mark Codex Impression
------------------------- */
export const markCodexImpression = async (req, res) => {
    try {
        const { codexIds } = req.body; // Array of IDs preferred
        if (!codexIds || !Array.isArray(codexIds)) return res.status(400).json({ message: "Invalid IDs" });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart.getTime() + 86400000);

        // OPTIMIZED: Use bulkWrite for O(1) database operation
        const ops = codexIds.map(id => ({
          updateOne: {
            filter: { 
              _id: id,
              "impressionHistory.date": { $not: { $elemMatch: { $gte: todayStart, $lt: todayEnd } } }
            },
            update: { 
              $push: { impressionHistory: { date: todayStart, count: 1 } },
              $inc: { impressions: 1 }
            }
          }
        }));

        const incOps = codexIds.map(id => ({
          updateOne: {
            filter: { 
              _id: id,
              "impressionHistory.date": { $gte: todayStart, $lt: todayEnd }
            },
            update: { 
              $inc: { impressions: 1, "impressionHistory.$.count": 1 }
            }
          }
        }));

        await Codex.bulkWrite([...ops, ...incOps]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Impression Error", error);
        res.status(500).json({ message: "Server error" });
    }
};

/* ----------------------
   Update Codex
------------------------- */
export const updateCodex = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    console.log("âœï¸ UPDATE CODEX ATTEMPT:", { slug, userId });

    const codex = await Codex.findOne({ slug, isDeleted: false });
    if (!codex) {
      console.log("âŒ UPDATE CODEX FAILED: Codex not found in DB for slug:", slug);
      return res.status(404).json({ message: "Codex not found" });
    }

    // author validation
    if (codex.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const fields = ["title", "content", "tags", "category", "coverImage", "cardShape", "subtitle", "excerpt", "proTips", "keyTakeaways", "seoTitle", "seoDescription", "focusKeywords"];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) codex[field] = req.body[field];
    });

    await codex.save();

    res.status(200).json({
      message: "Codex updated successfully",
      codex,
    });
  } catch (error) {
    console.error("UPDATE CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Soft Delete Codex
------------------------- */
export const deleteCodex = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const codex = await Codex.findOne({ slug, isDeleted: false });

    if (!codex) return res.status(404).json({ message: "Codex not found" });

    if (codex.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    codex.isDeleted = true;
    await codex.save();

    res.status(200).json({ message: "Codex deleted successfully" });
  } catch (error) {
    console.error("DELETE CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Publish Codex
------------------------- */
export const publishCodex = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const codex = await Codex.findOne({ slug, isDeleted: false });
    if (!codex) return res.status(404).json({ message: "Codex not found" });

    if (codex.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (codex.isPublished) {
      return res.status(200).json({ message: "Already published", codex });
    }

    codex.isPublished = true;
    await codex.save();

    // Award Rewards for publishing a codex (Atomic)
    const GamificationService = (await import("../services/GamificationService.js")).default;
    await GamificationService.awardRewards(userId, 'CREATE_CODEX');

    return res.status(200).json({ message: "Codex published successfully", codex });
  } catch (error) {
    console.error("PUBLISH CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get User's Dashboard Codex (Public & Private)
------------------------- */
export const getUserPublishedCodex = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const codex = await Codex.find({
      author: userId,
      isDeleted: false, // Return everything including drafts, but not deleted
    })
      .populate("author", "name email avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: codex,
    });
  } catch (error) {
    console.error("GET USER DASHBOARD CODEXS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



/* ----------------------
   Get Popular Topics
   Algorithm: Aggregates all published codex, unwinds tags,
   then scores each tag by weighted engagement:
   score = (totalViews * 1) + (totalLikes * 3) + (totalComments * 5) + (totalShares * 4)
   + RECENCY BONUS: codex updated in the last 30 days get a 1.5x multiplier.
   Results are Redis-cached for 5 minutes.
------------------------- */
export const getPopularTopics = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const cacheKey = `popular:topics:${limit}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topics = await Codex.aggregate([
      // Only published, non-deleted codex with at least one tag
      { $match: { isPublished: true, isDeleted: false, tags: { $exists: true, $ne: [] } } },

      // Add a recency multiplier field: 1.5 if updated in last 30 days, 1.0 otherwise
      {
        $addFields: {
          recencyMultiplier: {
            $cond: [{ $gte: ["$updatedAt", thirtyDaysAgo] }, 1.5, 1.0]
          },
          commentCount: { $size: { $ifNull: ["$comments", []] } }
        }
      },

      // Explode tags array â€” one document per tag
      { $unwind: "$tags" },

      // Normalize tags: lowercase and trim whitespace
      {
        $addFields: {
          tag: { $trim: { input: { $toLower: "$tags" } } }
        }
      },

      // Skip empty or very short tags
      { $match: { tag: { $regex: /^.{2,}$/ } } },

      // Group by tag and accumulate weighted engagement score
      {
        $group: {
          _id: "$tag",
          codexCount: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likesCount" },
          totalComments: { $sum: "$commentCount" },
          totalShares: { $sum: { $ifNull: ["$sharesCount", 0] } },
          // Weighted raw score with recency boost per codex
          rawScore: {
            $sum: {
              $multiply: [
                {
                  $add: [
                    "$views",
                    { $multiply: ["$likesCount", 3] },
                    { $multiply: ["$commentCount", 5] },
                    { $multiply: [{ $ifNull: ["$sharesCount", 0] }, 4] }
                  ]
                },
                "$recencyMultiplier"
              ]
            }
          }
        }
      },

      // Final score: rawScore + codexCount bonus (more codex = more legitimate topic)
      {
        $addFields: {
          score: { $add: ["$rawScore", { $multiply: ["$codexCount", 2] }] }
        }
      },

      // Sort by score descending
      { $sort: { score: -1 } },

      // Limit results
      { $limit: limit },

      // Shape the final output
      {
        $project: {
          _id: 0,
          tag: "$_id",
          codexCount: 1,
          totalViews: 1,
          totalLikes: 1,
          totalComments: 1,
          totalShares: 1,
          score: { $round: ["$score", 0] }
        }
      }
    ]);

    const result = { success: true, data: topics, cachedAt: new Date().toISOString() };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(result));

    res.status(200).json(result);
  } catch (error) {
    console.error("GET POPULAR TOPICS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Track Codex Impressions
------------------------- */
export const trackCodexImpressions = async (req, res) => {
  try {
    const { codexIds } = req.body;

    if (!codexIds || !Array.isArray(codexIds) || codexIds.length === 0) {
      return res.status(400).json({ message: "codexIds array required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const codexId of codexIds) {
      const redisKey = `impressions:codex:${codexId}`;
      await redis.incr(redisKey);
      await redis.expire(redisKey, 300);
    }

    res.status(200).json({ message: "Impressions tracked" });
  } catch (error) {
    console.error("TRACK CODEX IMPRESSIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};


