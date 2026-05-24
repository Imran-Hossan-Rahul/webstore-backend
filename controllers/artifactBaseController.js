import Codex from "../models/codex.model.js";
import User from "../models/User.model.js";
import Comment from "../models/Comment.model.js";
import geoip from "geoip-lite";
import redis from "../config/redis.js";

/* ----------------------
   Create Codex
------------------------- */
export const createCodex = async (req, res) => {
  try {
    const { title, content, tags, category, coverImage, cardShape } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title & content are required" });
    }

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const codex = await Codex.create({
      title,
      content,
      tags,
      category,
      coverImage,
      cardShape,
      author: userId,
      isPublished: false,
    });


    res.status(201).json({
      message: "Codex created successfully",
      codex,
    });
  } catch (error) {
    console.error("CREATE CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get All Codex (Simplified - No Cache)
------------------------- */
export const getAllCodex = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // SMART QUERY: Use Aggregation to filter out huge Base64 images

    const codex = await Codex.aggregate([
      { 
        $match: { 
          isPublished: true, 
          isDeleted: false 
        } 
      },
      { 
        $sort: { createdAt: -1 } 
      },
      { 
        $skip: skip 
      },
      { 
        $limit: limit 
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
          author: 1,
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
          from: "users", // Assuming collection name is 'users'
          localField: "author",
          foreignField: "_id",
          as: "authorDetails"
        }
      },
      {
        $unwind: {
          path: "$authorDetails",
          preserveNullAndEmptyArrays: true
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
          author: {
            _id: "$authorDetails._id",
            name: "$authorDetails.name",
            email: "$authorDetails.email",
            avatar: "$authorDetails.avatar"
          }
        }
      }
    ]);

    const totalCount = await Codex.countDocuments({ isPublished: true, isDeleted: false });

    const response = {
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
    console.error("❌ GET ALL CODEXS ERROR:", error);
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
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch from database with optimized query
    const codex = await Codex.findOne({
      slug,
      isDeleted: false,
    })
    .populate("author", "name email avatar")
    .lean(); // Use lean() for better performance

    if (!codex) {
      return res.status(404).json({ message: "Codex not found" });
    }
    
    // Cache for 5 minutes (300 seconds)
    await redis.setex(cacheKey, 300, JSON.stringify(codex));

    res.status(200).json(codex);
  } catch (error) {
    console.error("GET SINGLE CODEX ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get Artifact Analytics
------------------------- */
export const getArtifactAnalytics = async (req, res) => {
  try {
    const { slug } = req.params;
    const { range = '7d' } = req.query; // 1h, 24h, 7d, 30d
    const userId = req.user._id || req.user.id;

    const artifact = await Artifact.findOne({ slug, isDeleted: false })
      .populate("viewHistory.viewers.userId", "dateOfBirth");

    if (!artifact) return res.status(404).json({ message: "Artifact not found" });

    // Authorization
    if (artifact.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Determine Time Range
    const now = new Date();
    let startTime = new Date();
    let interval = 'day'; // 'minute', 'hour', 'day'

    switch(range) {
        case '1h':
            startTime.setHours(startTime.getHours() - 1);
            interval = 'minute';
            break;
        case '24h':
            startTime.setHours(startTime.getHours() - 24);
            interval = 'hour';
            break;
        case '7d':
            startTime.setDate(startTime.getDate() - 7);
            interval = 'day';
            break;
        case '30d':
            startTime.setDate(startTime.getDate() - 30);
            interval = 'day';
            break;
        default: 
            startTime.setDate(startTime.getDate() - 7);
    }

    // 1. Unified Trend Processing (O(N) Complexity)
    const allBuckets = new Map();
    let tempCurrent = new Date(startTime);
    if (interval === 'day') tempCurrent.setHours(0, 0, 0, 0);
    else if (interval === 'hour') tempCurrent.setMinutes(0, 0, 0);
    else if (interval === 'minute') tempCurrent.setSeconds(0, 0);

    while (tempCurrent <= now) {
        allBuckets.set(tempCurrent.toISOString(), { views: 0, likes: 0, comments: 0 });
        if (interval === 'minute') tempCurrent.setMinutes(tempCurrent.getMinutes() + 1);
        else if (interval === 'hour') tempCurrent.setHours(tempCurrent.getHours() + 1);
        else tempCurrent.setDate(tempCurrent.getDate() + 1);
    }

    const getKey = (timestamp) => {
        const d = new Date(timestamp);
        if (interval === 'day') d.setHours(0, 0, 0, 0);
        else if (interval === 'hour') d.setMinutes(0, 0, 0);
        else if (interval === 'minute') d.setSeconds(0, 0);
        return d.toISOString();
    };

    // Process Views and Demographics
    const countryStats = {};
    const ageGroups = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0 };
    let periodViews = 0;

    artifact.viewHistory.forEach(history => {
        history.viewers.forEach(viewer => {
            if (viewer.timestamp >= startTime) {
                const key = getKey(viewer.timestamp);
                if (allBuckets.has(key)) {
                    allBuckets.get(key).views++;
                    periodViews++;
                }

                // Demographics
                const country = viewer.country || "Unknown";
                countryStats[country] = (countryStats[country] || 0) + 1;

                if (viewer.userId?.dateOfBirth) {
                    const age = Math.abs(new Date(Date.now() - new Date(viewer.userId.dateOfBirth).getTime()).getUTCFullYear() - 1970);
                    if (age >= 18 && age <= 24) ageGroups['18-24']++;
                    else if (age >= 25 && age <= 34) ageGroups['25-34']++;
                    else if (age >= 35 && age <= 44) ageGroups['35-44']++;
                    else if (age >= 45 && age <= 54) ageGroups['45-54']++;
                    else if (age >= 55) ageGroups['55+']++;
                    else ageGroups['Unknown']++;
                } else ageGroups['Unknown']++;
            }
        });
    });

    // Process Likes (if applicable to artifacts)
    artifact.likeHistory?.forEach(like => {
        if (new Date(like.timestamp) >= startTime) {
            const key = getKey(like.timestamp);
            if (allBuckets.has(key)) allBuckets.get(key).likes++;
        }
    });

    // Process Comments
    const commentsList = await Comment.find({ _id: { $in: artifact.comments }, createdAt: { $gte: startTime } }).select('createdAt');
    commentsList.forEach(comment => {
        const key = getKey(comment.createdAt);
        if (allBuckets.has(key)) allBuckets.get(key).comments++;
    });

    const mergedTrend = Array.from(allBuckets, ([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const countryDistribution = Object.entries(countryStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const ageDistribution = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

    res.status(200).json({
      totalViews: artifact.viewsCount || 0,
      totalLikes: artifact.likesCount || 0,
      totalComments: artifact.comments.length,
      periodViews,
      viewsTrend: mergedTrend,
      countryDistribution,
      ageDistribution
    });

  } catch (error) {
    console.error("GET ARTIFACT ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Like Codex
------------------------- */
export const likeCodex = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user._id || req.user.id;
        
        const codex = await Codex.findOne({ slug, isDeleted: false });
        if (!codex) return res.status(404).json({ message: "Codex not found" });

        const isLiked = codex.likes.includes(userId);

        if (isLiked) {
            // Unliking
            codex.likes.pull(userId);
            codex.likesCount = Math.max(0, codex.likesCount - 1);
            // Optionally remove from likeHistory? Usually analytics keeps history even if unliked, 
            // but for "Current Status" we usually remove.
            // For strictly "Activity" graph, we shouldn't delete past actions. 
            // BUT if we just pull generic timestamp, we might lose *when* it was liked.
            // Let's leave history alone for now (Like activity happened). 
            // OR finding specific history entry is hard without unique ID for the action.
            // Simplified: Just update current state.
        } else {
            // Liking
            codex.likes.push(userId);
            codex.likesCount += 1;
            // Add to history
            codex.likeHistory.push({
                userId,
                timestamp: new Date()
            });
        }

        await codex.save();
        res.status(200).json({ success: true, likesCount: codex.likesCount, isLiked: !isLiked });
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
    
    // Check cooldown
    const hasCooldown = await redis.get(cooldownKey);
    if (hasCooldown) {
      return res.status(200).json({ message: "View already counted (cooldown)", views: codex.views });
    }

    const redisKey = `views:codex:${codex._id}`;
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

    res.status(200).json({ message: "View tracked", views: codex.views + 1 });
  } catch (error) {
    console.error("TRACK CODEX VIEW ERROR:", error);
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

    const codex = await Codex.findOne({ slug, isDeleted: false });
    if (!codex) return res.status(404).json({ message: "Codex not found" });

    // author validation
    if (codex.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const fields = ["title", "content", "tags", "category", "coverImage", "cardShape"];

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


