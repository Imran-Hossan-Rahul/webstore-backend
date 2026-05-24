import Post from "../models/Post.model.js";
import logger from "../utils/logger.js";
import { postLikeQueue } from "../queues/postLikeQueue.js";
import { devlogImageQueue } from "../queues/devlogImageQueue.js";
import { devlogResourceQueue } from "../queues/devlogResourceQueue.js";
import { quickPostQueue } from "../queues/quickPostQueue.js";
import redis from "../config/redis.js";

/**
 * @desc    Update an existing post
 * @route   PUT /api/v1/posts/:id
 * @access  Private
 */
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, devlogStats, category, images, title, tags, updateReason, seoTitle, seoDescription, focusKeywords } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Check ownership
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to update this post" });
    }

    // 🚀 Activity Logging Logic
    const activityLog = post.devlogStats?.activityLog || [];
    const newLogs = [];

    // Track scalar changes
    if (title !== undefined && title !== post.title) {
        newLogs.push({ type: 'update', action: 'Title Changed', details: `Project title updated to: "${title}"`, date: new Date() });
        post.title = title;
    }
    if (category !== undefined && category !== post.category) {
        newLogs.push({ type: 'update', action: 'Category Changed', details: `Shifted from ${post.category} to ${category}`, date: new Date() });
        post.category = category;
    }
    if (content !== undefined && content !== post.content) {
        newLogs.push({ type: 'update', action: 'Description Updated', details: 'Project documentation/description was refined', date: new Date() });
        post.content = content;
    }
    if (images !== undefined && JSON.stringify(images) !== JSON.stringify(post.images)) {
        newLogs.push({ type: 'update', action: 'Visuals Updated', details: 'Project showcase images were modified', date: new Date() });
        post.images = images;
    }
    if (tags !== undefined) {
        post.tags = tags;
    }
    
    // Update SEO fields
    if (seoTitle !== undefined) post.seoTitle = seoTitle;
    if (seoDescription !== undefined) post.seoDescription = seoDescription;
    if (focusKeywords !== undefined) post.focusKeywords = focusKeywords;

    // Accumulate updateReason history
    if (updateReason && updateReason.trim()) {
        const existingUR = post.devlogStats?.updateReasons || [];
        // Add to standard updateReasons
        const newUR = { reason: updateReason.trim(), updatedAt: new Date() };
        
        // Also add to Activity Log for the unified timeline
        newLogs.push({ 
            type: 'update', 
            action: 'Manual Update', 
            details: updateReason.trim(), 
            date: new Date() 
        });

        // We'll update the whole devlogStats below
    }

    // Deep merge devlogStats and track internal changes
    if (devlogStats) {
        const existingStats = post.devlogStats ? (typeof post.devlogStats.toObject === 'function' ? post.devlogStats.toObject() : post.devlogStats) : {};
        
        // Track status/phase changes
        if (devlogStats.status && devlogStats.status !== existingStats.status) {
            newLogs.push({ type: 'status', action: 'Status Changed', details: `Project status moved to ${devlogStats.status}`, date: new Date() });
        }
        if (devlogStats.phase && devlogStats.phase !== existingStats.phase) {
            newLogs.push({ type: 'status', action: 'Phase Shift', details: `Project entered ${devlogStats.phase} phase`, date: new Date() });
        }

        // Track timeline extensions
        if (devlogStats.extensions && devlogStats.extensions.length > (existingStats.extensions?.length || 0)) {
            const latestExt = devlogStats.extensions[devlogStats.extensions.length - 1];
            newLogs.push({ 
                type: 'extension', 
                action: 'Timeline Extended', 
                details: `Deadline extended. Rationale: ${latestExt.reason}`, 
                date: new Date() 
            });
        }

        // Merge logic
        post.devlogStats = {
            ...existingStats,
            ...devlogStats,
            updateReasons: updateReason ? [...(existingStats.updateReasons || []), { reason: updateReason.trim(), updatedAt: new Date() }] : (existingStats.updateReasons || []),
            activityLog: [...activityLog, ...newLogs]
        }; 
        post.isEdited = true;
    } else if (newLogs.length > 0) {
        // If only top-level fields changed
        post.devlogStats = {
            ...(post.devlogStats || {}),
            activityLog: [...activityLog, ...newLogs]
        };
    }

    await post.save();

    
    // Re-populate to return full object
    // Updated to use craftsman fallback
    await post.populate({
        path: "user",
        select: "name profilePicture email craftsmanProfileId",
        populate: { path: "craftsmanProfileId", select: "profilePicture" }
    });

    // Transform for response
    const postObj = post.toObject();
    postObj.user = {
        _id: post.user._id,
        name: post.user.name,
        username: post.user.username || (post.user.email ? post.user.email.split('@')[0] : 'user'),
        avatar: post.user.profilePicture || post.user.craftsmanProfileId?.profilePicture
    };

    res.status(200).json({
      success: true,
      data: postObj
    });

  } catch (error) {
    logger.error("Update Post Error:", error);
    res.status(500).json({ success: false, message: "Failed to update post" });
  }
};

/**
 * @desc    Create a quick text post with media
 * @route   POST /api/v1/posts
 * @access  Private
 */
export const createQuickPost = async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user._id;
    const files = req.files;

    if (!content && (!files || files.length === 0)) {
      return res.status(400).json({ success: false, message: "Post must have content or media" });
    }

    const newPost = await Post.create({
      user: userId,
      content: content || "",
      postType: "text",
      media: []
    });

    // Queue media uploads if files exist
    if (files && files.length > 0) {
      for (const file of files) {
        const mediaType = file.mimetype.startsWith("image/") ? "image" : 
                         file.mimetype.startsWith("video/") ? "video" : "file";
        
        await quickPostQueue.add("upload-quick-post-media", {
          filePath: file.path,
          postId: newPost._id.toString(),
          mediaType,
          originalName: file.originalname
        });
      }
    }

    await newPost.populate({
      path: "user",
      select: "name profilePicture email craftsmanProfileId",
      populate: { path: "craftsmanProfileId", select: "profilePicture" }
    });

    const postObj = newPost.toObject();
    postObj.user = {
      _id: newPost.user._id,
      name: newPost.user.name,
      username: newPost.user.username || (newPost.user.email ? newPost.user.email.split('@')[0] : 'user'),
      avatar: newPost.user.profilePicture || newPost.user.craftsmanProfileId?.profilePicture
    };

    res.status(201).json({
      success: true,
      data: postObj
    });

  } catch (error) {
    logger.error("Create Quick Post Error:", error);
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
};

/**
 * @desc    Create a new post
 * @route   POST /api/v1/posts/create
 * @access  Private
 */
export const createPost = async (req, res) => {
  try {
    const { title, content, images, postType, category, tags, devlogStats, seoTitle, seoDescription, focusKeywords } = req.body;
    const userId = req.user._id;

    // Check permissions
    if (!req.user.hasCraftsmanAccount) {
        if (postType === 'devlog' || (devlogStats && Object.keys(devlogStats).length > 0)) {
             return res.status(403).json({ success: false, message: "Only craftsmen can create devlogs." });
        }
    }

    if (!content && (!images || images.length === 0)) {
       return res.status(400).json({ success: false, message: "Post must have content or images" });
    }

    // Auto-generate slug from title for SEO-friendly URLs
    const generateSlug = (str) => str?.toString().toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 80);

    // Create Post immediately
    const newPost = await Post.create({
      user: userId,
      title,
      slug: generateSlug(title),
      content,
      images: [], // Images added via craftsman if uploaded
      postType,
      category,
      tags,
      seoTitle,
      seoDescription,
      focusKeywords,
      devlogStats: {
          ...devlogStats,
          activityLog: [{
              type: 'create',
              action: 'Project Initiated',
              details: 'The devlog was officially published and the project journey began.',
              date: new Date()
          }]
      }
    });

    if (images && images.length > 0) {
        newPost.images = images;
        await newPost.save();
    }

    // Process Devlog Resources (if any)
    if (devlogStats && devlogStats.resources && Array.isArray(devlogStats.resources)) {
        for (const res of devlogStats.resources) {
            if (res.tempPath) {
                // It's a pending upload
                await devlogResourceQueue.add("devlog-resource-upload", {
                    filePath: res.tempPath,
                    postId: newPost._id,
                    userId: userId,
                    originalName: res.originalName
                });
            }
        }
    }

    // Populate user details for immediate frontend display
    // Updated to use craftsman callback
    await newPost.populate({
        path: "user",
        select: "name profilePicture email craftsmanProfileId",
        populate: { path: "craftsmanProfileId", select: "profilePicture" }
    });

    // Transform for response
    const postObj = newPost.toObject();
    postObj.user = {
        _id: newPost.user._id,
        name: newPost.user.name,
        username: newPost.user.username || (newPost.user.email ? newPost.user.email.split('@')[0] : 'user'),
        avatar: newPost.user.profilePicture || newPost.user.craftsmanProfileId?.profilePicture
    };

    // Award Rewards for creating a post/devlog (Atomic)
    const GamificationService = (await import("../services/GamificationService.js")).default;
    const rewardAction = postType === 'devlog' ? 'CREATE_DEVLOG' : 'CREATE_POST';
    await GamificationService.awardRewards(userId, rewardAction);

    res.status(201).json({
      success: true,
      data: postObj
    });

  } catch (error) {
    logger.error("Create Post Error:", error);
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
};

/**
 * @desc    Get all posts (Feed)
 * @route   GET /api/v1/posts
 * @access  Public/Private
 */
export const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { type, userId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (type) {
        query.postType = type;
    }
    
    if (userId) {
        query.user = userId;
        // If it's NOT the owner requesting, only show active posts
        const isOwner = req.user && (req.user._id.toString() === userId.toString());
        if (!isOwner) {
            query.status = "active";
        }
    } else {
        // Default view: only active
        query.status = "active";
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
          path: "user",
          select: "name profilePicture email craftsmanProfileId",
          populate: { path: "craftsmanProfileId", select: "profilePicture" }
      })
      .lean();

    const total = await Post.countDocuments(query);

    // Inject isFavorited status
    // Optimization: Fetch only needed part of user
    let user = null;
    if (req.user && req.user._id) {
         try {
             // Dynamic import to avoid circular dependency if any
             const User = (await import("../models/User.model.js")).default;
             user = await User.findById(req.user._id).select('favorites');
         } catch(e) { logger.error("User fetch error", e); }
    }
    
    // Create a Set of favorite strings for O(1) lookup
    const favoriteSet = new Set(user && user.favorites ? user.favorites.map(id => id.toString()) : []);

    const postsWithStatus = posts.map(post => {
        const isFav = favoriteSet.has(post._id.toString());
        // Fix user mapping
        const postUser = post.user ? {
            _id: post.user._id,
            name: post.user.name,
            username: post.user.username || (post.user.email ? post.user.email.split('@')[0] : 'user'),
            avatar: post.user.profilePicture || post.user.craftsmanProfileId?.profilePicture
        } : null;

        return {
            ...post,
            user: postUser,
            isFavorited: isFav
        };
    });

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      hasMore: skip + posts.length < total,
      data: postsWithStatus
    });

  } catch (error) {
    logger.error("Get Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
};

/**
 * @desc    Get single post by ID
 * @route   GET /api/v1/posts/:id
 * @access  Public/Private
 */
export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findById(id)
      .populate({
          path: "user",
          select: "name profilePicture email craftsmanProfileId",
          populate: { path: "craftsmanProfileId", select: "profilePicture" }
      })
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Inject isFavorited status
    let isFavorited = false;
    if (req.user && req.user._id) {
         try {
             const User = (await import("../models/User.model.js")).default;
             const user = await User.findById(req.user._id).select('favorites');
             if (user && user.favorites) {
                 const favoriteSet = new Set(user.favorites.map(id => id.toString()));
                 isFavorited = favoriteSet.has(post._id.toString());
             }
         } catch(e) { console.error("User fetch error", e); }
    }

    // Fix user mapping
    const postUser = post.user ? {
        _id: post.user._id,
        name: post.user.name,
        username: post.user.username || (post.user.email ? post.user.email.split('@')[0] : 'user'),
        avatar: post.user.profilePicture || post.user.craftsmanProfileId?.profilePicture
    } : null;

    res.status(200).json({
      success: true,
      data: { ...post, user: postUser, isFavorited }
    });

  } catch (error) {
    logger.error("Get Post By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch post" });
  }
};

/**
 * @desc    Toggle Like on a post (Queued)
 * @route   PUT /api/v1/posts/:id/like
 * @access  Private
 */
export const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // 🚀 FIX: O(log n) DB check via index instead of O(n) .some() over likedBy array
    // No need to load the likedBy array at all
    const post = await Post.findById(id).select('_id likes').lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // O(log n): MongoDB array index check — no JS iteration
    const isLiked = await Post.exists({ _id: id, likedBy: userId });
    const action = isLiked ? "unlike" : "like";

    // Optimistic count (post.likes is a number here)
    const newLikes = isLiked ? Math.max(0, (post.likes || 0) - 1) : (post.likes || 0) + 1;
    
    // Add to Queue
    await postLikeQueue.add("post-like", {
        postId: id,
        userId: userId,
        action: action
    }, {
        removeOnComplete: true,
        attempts: 3
    });

    res.status(200).json({
      success: true,
      likes: newLikes,
      isLiked: !isLiked,
      queued: true
    });

  } catch (error) {
    logger.error("Like Post Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle like" });
  }
};

/**
 * @desc    Increment post views (buffered via Redis)
 * @route   POST /api/v1/posts/:id/view
 * @access  Public
 */
export const viewPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id || null;
    const ip = req.ip || "unknown"; // In production behind proxy use x-forwarded-for
    const userAgent = req.headers['user-agent'];
    const geo = null; // geoip lookup optional here

    // 1. Check if post exists (Optional: Cache existence check)
    // For speed, we might skip DB check if we trust ID, but let's do a quick check or cache it.
    // For now, assume valid ID to save DB call, craftsman will fail if invalid.
    
    // 2. Cooldown check
    const userIdentifier = userId || ip;
    const cooldownKey = `cooldown:view:post:${id}:${userIdentifier}`;
    const hasCooldown = await redis.get(cooldownKey);
    
    if (hasCooldown) {
         return res.status(200).json({ message: "View already counted", views: 0 }); // Return dummy or current cached
    }

    // 3. Buffer View
    const redisKey = `views:post:${id}`;
    const existingData = await redis.get(redisKey);
    let viewData = existingData ? JSON.parse(existingData) : { count: 0, viewers: [] };
    
    viewData.count++;
    viewData.viewers.push({
        userId,
        ip,
        timestamp: new Date()
    });

    await redis.set(redisKey, JSON.stringify(viewData), 'EX', 3600); // 1 hr TTL in case craftsman dies

    // 4. Set Cooldown (e.g. 5 minutes)
    await redis.set(cooldownKey, "1", "EX", 300);

    // 5. Respond
    res.status(200).json({ success: true, message: "View tracked" });

  } catch (error) {
    console.error("View inc error", error);
    res.status(200).json({ success: true }); // Fail silently to patron
  }
};

import { shareQueue } from "../queues/shareQueue.js";

/**
 * @desc    Share a post (Queued)
 * @route   POST /api/v1/posts/:id/share
 * @access  Public
 */
export const sharePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { platform } = req.body;
        const userId = req.user?._id || null;

        // Add to Queue
        await shareQueue.add("share-post", {
            itemId: id,
            type: "post",
            userId,
            platform
        }, {
            removeOnComplete: true,
            attempts: 3
        });

        res.status(200).json({ success: true, queued: true });
    } catch (error) {
        console.error("Share Post Error:", error);
        res.status(500).json({ success: false, message: "Failed to share post" });
    }
};

/**
 * @desc    Mark post impression (buffered via Redis)
 * @route   POST /api/v1/posts/impression
 * @access  Public
 */
export const markPostImpression = async (req, res) => {
    try {
        const { postIds } = req.body;
        if (!postIds || !Array.isArray(postIds)) {
            return res.status(400).json({ message: "Invalid IDs" });
        }

        // Buffer impressions to Redis
        // Craftsman will aggregate and flush
        const pipeline = redis.pipeline();
        postIds.forEach(id => {
            pipeline.incr(`impressions:delta:post:${id}`);
            pipeline.expire(`impressions:delta:post:${id}`, 3600); // 1h TTL
        });
        await pipeline.exec();

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Impression error", error);
        res.status(500).json({ message: "Server error" });
    }
};


/**
 * @desc    Get current user's posts for craftsman dashboard
 * @route   GET /api/v1/posts/my-posts
 * @access  Private
 */
export const getMyPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Fetch all NON-DEVLOG posts by user (excluding devlog posts)
    const matchCriteria = { 
      user: userId, 
      status: { $nin: ['deleted', 'Deleted'] },
      postType: { $ne: 'devlog' } // Exclude devlog posts
    };

    const [posts, total] = await Promise.all([
      Post.find(matchCriteria)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(matchCriteria)
    ]);

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    logger.error("Get My Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your posts" });
  }
};

/**
 * @desc    Get current user's DEVLOG posts for craftsman dashboard
 * @route   GET /api/v1/posts/my-devlog-posts
 * @access  Private
 */
export const getMyDevlogPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Fetch only DEVLOG posts by user
    const matchCriteria = { 
      user: userId, 
      status: { $ne: 'deleted' },
      postType: 'devlog'
    };

    const [posts, total] = await Promise.all([
      Post.find(matchCriteria)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(matchCriteria)
    ]);

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    });

  } catch (error) {
    logger.error("Get My Devlog Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your devlog posts" });
  }
};

/**
 * @desc    Get Post Analytics
 * @route   GET /api/v1/posts/:id/analytics
 * @access  Private (Author only)
 */
export const getPostAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '7d' } = req.query;
    const userId = req.user._id || req.user.id;

    // 🚀 FIX: Lightweight auth check — no full populate needed
    const postMeta = await Post.findById(id)
      .select('_id user views likes commentsCount sharesCount impressions')
      .lean();
    if (!postMeta) return res.status(404).json({ message: "Post not found" });
    if (postMeta.user.toString() !== userId.toString()) {
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

    // 🚀 ALL computation pushed to MongoDB — O(n) single pass per aggregation
    const [viewAgg, likeAgg, shareAgg, impressionAgg, countryAgg] = await Promise.all([

      // 1. Views trend
      Post.aggregate([
        { $match: { _id: postMeta._id } },
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

      // 2. Likes trend
      Post.aggregate([
        { $match: { _id: postMeta._id } },
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
      Post.aggregate([
        { $match: { _id: postMeta._id } },
        { $unwind: "$shareHistory" },
        { $match: { "shareHistory.timestamp": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$shareHistory.timestamp" } },
            shares: { $sum: 1 }
          }
        }
      ]),

      // 4. Impressions trend
      Post.aggregate([
        { $match: { _id: postMeta._id } },
        { $unwind: "$impressionHistory" },
        { $match: { "impressionHistory.date": { $gte: startTime } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$impressionHistory.date" } },
            impressions: { $sum: "$impressionHistory.count" }
          }
        }
      ]),

      // 5. Country distribution
      Post.aggregate([
        { $match: { _id: postMeta._id } },
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

    // Merge trend buckets
    const buckets = new Map();
    const addBucket = (key) => { if (!buckets.has(key)) buckets.set(key, { date: key, views: 0, likes: 0, shares: 0, impressions: 0 }); };

    viewAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).views = r.views; });
    likeAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).likes = r.likes; });
    shareAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).shares = r.shares; });
    impressionAgg.forEach(r => { addBucket(r._id); buckets.get(r._id).impressions = r.impressions; });

    const viewsTrend = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
    const periodViews = viewAgg.reduce((s, r) => s + r.views, 0);

    res.status(200).json({
      totalViews: postMeta.views || 0,
      totalLikes: postMeta.likes || 0,
      totalComments: postMeta.commentsCount || 0,
      totalShares: postMeta.sharesCount || 0,
      totalImpressions: postMeta.impressions || 0,
      periodViews,
      viewsTrend,
      countryDistribution: countryAgg,
      ageDistribution: [] // lightweight exclusion
    });

  } catch (error) {
    logger.error("Get Post Analytics Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch analytics" });
  }
};

