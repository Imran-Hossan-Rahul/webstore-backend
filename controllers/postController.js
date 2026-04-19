import Post from "../models/Post.model.js";
import logger from "../utils/logger.js";
import { postLikeQueue } from "../queues/postLikeQueue.js";
import { postImageQueue } from "../queues/postImageQueue.js";
import { projectResourceQueue } from "../queues/projectResourceQueue.js";
import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * @desc    Update an existing post
 * @route   PUT /api/v1/posts/:id
 * @access  Private
 */
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, projectStats, category } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Check ownership
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to update this post" });
    }

    // Update fields
    if (content) post.content = content;
    if (category) post.category = category;
    
    // Deep merge or replace projectStats? Replace is safer to handle deletions, but let's be careful.
    // The frontend should send the COMPLETE object.
    if (projectStats) {
        // Ensure legacy data is preserved if not sent? No, assume full overwrite for edit form.
        post.projectStats = { ...post.projectStats, ...projectStats }; 
        post.isEdited = true;
    }

    await post.save();
    
    // Re-populate to return full object
    // Updated to use creator fallback
    await post.populate({
        path: "user",
        select: "name profilePicture email creatorProfileId",
        populate: { path: "creatorProfileId", select: "profilePicture" }
    });

    // Transform for response
    const postObj = post.toObject();
    postObj.user = {
        _id: post.user._id,
        name: post.user.name,
        username: post.user.username || (post.user.email ? post.user.email.split('@')[0] : 'user'),
        avatar: post.user.profilePicture || post.user.creatorProfileId?.profilePicture
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
      const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
      const mediaQueue = new Queue("quick-post-media", { connection });

      for (const file of files) {
        const mediaType = file.mimetype.startsWith("image/") ? "image" : 
                         file.mimetype.startsWith("video/") ? "video" : "file";
        
        await mediaQueue.add("upload-quick-post-media", {
          filePath: file.path,
          postId: newPost._id.toString(),
          mediaType,
          originalName: file.originalname
        });
      }
    }

    await newPost.populate({
      path: "user",
      select: "name profilePicture email creatorProfileId",
      populate: { path: "creatorProfileId", select: "profilePicture" }
    });

    const postObj = newPost.toObject();
    postObj.user = {
      _id: newPost.user._id,
      name: newPost.user.name,
      username: newPost.user.username || (newPost.user.email ? newPost.user.email.split('@')[0] : 'user'),
      avatar: newPost.user.profilePicture || newPost.user.creatorProfileId?.profilePicture
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
    const { content, images, postType, category, projectStats } = req.body;
    const userId = req.user._id;

    // Check permissions
    if (!req.user.hasCreatorAccount) {
        if (postType === 'project' || (projectStats && Object.keys(projectStats).length > 0)) {
             return res.status(403).json({ success: false, message: "Only creators can create projects." });
        }
    }

    if (!content && (!images || images.length === 0)) {
       return res.status(400).json({ success: false, message: "Post must have content or images" });
    }

    // Create Post immediately
    const newPost = await Post.create({
      user: userId,
      content,
      images: [], // Images added via worker if uploaded
      postType,
      category,
      projectStats
    });

    if (images && images.length > 0) {
        newPost.images = images;
        await newPost.save();
    }

    // Process Project Resources (if any)
    if (projectStats && projectStats.resources && Array.isArray(projectStats.resources)) {
        for (const res of projectStats.resources) {
            if (res.tempPath) {
                // It's a pending upload
                await projectResourceQueue.add("project-resource-upload", {
                    filePath: res.tempPath,
                    postId: newPost._id,
                    userId: userId,
                    originalName: res.originalName
                });
            }
        }
    }

    // Populate user details for immediate frontend display
    // Updated to use creator callback
    await newPost.populate({
        path: "user",
        select: "name profilePicture email creatorProfileId",
        populate: { path: "creatorProfileId", select: "profilePicture" }
    });

    // Transform for response
    const postObj = newPost.toObject();
    postObj.user = {
        _id: newPost.user._id,
        name: newPost.user.name,
        username: newPost.user.username || (newPost.user.email ? newPost.user.email.split('@')[0] : 'user'),
        avatar: newPost.user.profilePicture || newPost.user.creatorProfileId?.profilePicture
    };

    // Award XP for creating a post
    const GamificationService = (await import("../services/GamificationService.js")).default;
    await GamificationService.awardXP(userId, 'CREATE_POST');

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
    const skip = (page - 1) * limit;

    const posts = await Post.find({ status: "active" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
          path: "user",
          select: "name profilePicture email creatorProfileId",
          populate: { path: "creatorProfileId", select: "profilePicture" }
      })
      .lean();

    const total = await Post.countDocuments({ status: "active" });

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
            avatar: post.user.profilePicture || post.user.creatorProfileId?.profilePicture
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
          select: "name profilePicture email creatorProfileId",
          populate: { path: "creatorProfileId", select: "profilePicture" }
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
                 isFavorited = user.favorites.map(id => id.toString()).includes(post._id.toString());
             }
         } catch(e) { console.error("User fetch error", e); }
    }

    // Fix user mapping
    const postUser = post.user ? {
        _id: post.user._id,
        name: post.user.name,
        username: post.user.username || (post.user.email ? post.user.email.split('@')[0] : 'user'),
        avatar: post.user.profilePicture || post.user.creatorProfileId?.profilePicture
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

    const post = await Post.findById(id).select('_id likedBy likes');
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const isLiked = post.likedBy.includes(userId);
    const action = isLiked ? "unlike" : "like";

    // Optimistic Response
    const newLikes = isLiked ? Math.max(0, post.likes - 1) : post.likes + 1;
    
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
    res.status(500).json({ success: false, message: `Failed to toggle like: ${error.message}` });
  }
};

/**
 * @desc    Increment post views
 * @route   POST /api/v1/posts/:id/view
 * @access  Public
 */
const redis = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });

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
    // For now, assume valid ID to save DB call, worker will fail if invalid.
    
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

    await redis.set(redisKey, JSON.stringify(viewData), 'EX', 3600); // 1 hr TTL in case worker dies

    // 4. Set Cooldown (e.g. 5 minutes)
    await redis.set(cooldownKey, "1", "EX", 300);

    // 5. Respond
    res.status(200).json({ success: true, message: "View tracked" });

  } catch (error) {
    console.error("View inc error", error);
    res.status(200).json({ success: true }); // Fail silently to client
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
        // Worker will aggregate and flush
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
 * @desc    Get current user's posts for creator dashboard
 * @route   GET /api/v1/posts/my-posts
 * @access  Private
 */
export const getMyPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fetch all NON-PROJECT posts by user (excluding project posts)
    const posts = await Post.find({ 
      user: userId, 
      status: { $ne: 'deleted' },
      postType: { $ne: 'project' } // Exclude project posts
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: posts
    });

  } catch (error) {
    logger.error("Get My Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your posts" });
  }
};

/**
 * @desc    Get current user's PROJECT posts for creator dashboard
 * @route   GET /api/v1/posts/my-project-posts
 * @access  Private
 */
export const getMyProjectPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fetch only PROJECT posts by user
    const posts = await Post.find({ 
      user: userId, 
      status: { $ne: 'deleted' },
      postType: 'project'
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: posts
    });

  } catch (error) {
    logger.error("Get My Project Posts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your project posts" });
  }
};

/**
 * @desc    Get Post Analytics
 * @route   GET /api/v1/posts/:id/analytics
 * @access  Private (Author only)
 */
export const getPostAnalytics = async (req, res) => {
  try {
    // Dynamic import to avoid circular dep if needed, or just standard import above
    const { id } = req.params;
    const { range = '7d' } = req.query;
    const userId = req.user._id || req.user.id;

    const post = await Post.findById(id)
       .populate({
           path: 'viewHistory.viewers.userId',
           select: 'dateOfBirth'
       });

    if (!post) return res.status(404).json({ message: "Post not found" });

    // Authorization
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Determine Time Range
    const now = new Date();
    let startTime = new Date();
    let interval = 'day';

    switch(range) {
        case '1h': startTime.setHours(startTime.getHours() - 1); interval = 'minute'; break;
        case '24h': startTime.setHours(startTime.getHours() - 24); interval = 'hour'; break;
        case '7d': startTime.setDate(startTime.getDate() - 7); interval = 'day'; break;
        case '30d': startTime.setDate(startTime.getDate() - 30); interval = 'day'; break;
        default: startTime.setDate(startTime.getDate() - 7); interval = 'day';
    }

    // Process Histories
    const viewTimestamps = [];
    post.viewHistory?.forEach(history => {
        history.viewers?.forEach(viewer => {
            if (new Date(viewer.timestamp) >= startTime) {
                viewTimestamps.push(new Date(viewer.timestamp));
            }
        });
    });

    const likesInPeriod = post.likeHistory?.filter(l => new Date(l.timestamp) >= startTime) || [];
    const sharesInPeriod = post.shareHistory?.filter(s => new Date(s.timestamp) >= startTime) || [];
    const impressionsInPeriod = post.impressionHistory?.filter(i => new Date(i.date) >= startTime) || [];

    // Trend Map
    const trendMap = new Map();
    let current = new Date(startTime);
    if (interval === 'day') current.setHours(0,0,0,0);
    if (interval === 'hour') current.setMinutes(0,0,0);
    if (interval === 'minute') current.setSeconds(0,0);

    while (current <= now) {
        trendMap.set(current.toISOString(), { views: 0, likes: 0, shares: 0, impressions: 0 });
        if (interval === 'minute') current.setMinutes(current.getMinutes() + 1);
        else if (interval === 'hour') current.setHours(current.getHours() + 1);
        else current.setDate(current.getDate() + 1);
    }

    // Populate Trend Map
    const addToMap = (date, field, val=1) => {
        const key = new Date(date);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (trendMap.has(keyStr)) {
            trendMap.get(keyStr)[field] += val;
        }
    };

    viewTimestamps.forEach(d => addToMap(d, 'views'));
    likesInPeriod.forEach(d => addToMap(d.timestamp, 'likes'));
    sharesInPeriod.forEach(d => addToMap(d.timestamp, 'shares'));
    impressionsInPeriod.forEach(d => addToMap(d.date, 'impressions', d.count));

    const mergedTrend = Array.from(trendMap, ([date, counts]) => ({ 
        date, ...counts
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Demographics
    const countryStats = {};
    const ageGroups = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0 };

     post.viewHistory?.forEach(history => {
        history.viewers?.forEach(viewer => {
            if (new Date(viewer.timestamp) >= startTime) {
                const country = viewer.country || "Unknown";
                countryStats[country] = (countryStats[country] || 0) + 1;

                if (viewer.userId && viewer.userId.dateOfBirth) {
                    const dob = new Date(viewer.userId.dateOfBirth);
                    const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
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

    res.status(200).json({
        totalViews: post.views || 0,
        totalLikes: post.likes || 0,
        totalComments: post.commentsCount || 0,
        totalShares: post.sharesCount || 0,
        totalImpressions: post.impressions || 0,
        periodViews: viewTimestamps.length,
        viewsTrend: mergedTrend,
        countryDistribution: Object.entries(countryStats).map(([n, v]) => ({ name: n, value: v })).sort((a,b) => b.value - a.value),
        ageDistribution: Object.entries(ageGroups).map(([n, v]) => ({ name: n, value: v }))
    });

  } catch (error) {
    logger.error("Get Post Analytics Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch analytics" });
  }
};
