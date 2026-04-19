import Blog from "../models/blog.model.js";
import User from "../models/User.model.js";
import Comment from "../models/Comment.model.js";
import geoip from "geoip-lite";
import redis from "../config/redis.js";

/* ----------------------
   Create Blog
------------------------- */
export const createBlog = async (req, res) => {
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

    const blog = await Blog.create({
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
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    console.error("CREATE BLOG ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get All Blogs (Simplified - No Cache)
------------------------- */
export const getAllBlogs = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // SMART QUERY: Use Aggregation to filter out huge Base64 images

    const blogs = await Blog.aggregate([
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

    const totalCount = await Blog.countDocuments({ isPublished: true, isDeleted: false });

    const response = {
      blogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalBlogs: totalCount,
        hasMore: skip + blogs.length < totalCount
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ GET ALL BLOGS ERROR:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ----------------------
   Get Single Blog by Slug
------------------------- */
export const getSingleBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Check Redis cache first
    const cacheKey = `blog:${slug}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch from database with optimized query
    const blog = await Blog.findOne({
      slug,
      isDeleted: false,
    })
    .populate("author", "name email avatar")
    .lean(); // Use lean() for better performance

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    
    // Cache for 5 minutes (300 seconds)
    await redis.setex(cacheKey, 300, JSON.stringify(blog));

    res.status(200).json(blog);
  } catch (error) {
    console.error("GET SINGLE BLOG ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get Blog Analytics
------------------------- */
export const getBlogAnalytics = async (req, res) => {
  try {
    const { slug } = req.params;
    const { range = '7d' } = req.query; // 1h, 24h, 7d, 30d
    const userId = req.user._id || req.user.id;

    const blog = await Blog.findOne({ slug, isDeleted: false })
      .populate("viewHistory.viewers.userId", "dateOfBirth");

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Authorization
    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Determine Time Range
    const now = new Date();
    let startTime = new Date();
    let interval = 'day'; // 'minute', 'hour', 'day'
    let formatLabel = (date) => date.toISOString().split('T')[0]; // Default YYYY-MM-DD

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

    // 1. Process Views Trend
    // We strictly use `viewers.timestamp` for accuracy
    const viewTimestamps = [];
    
    blog.viewHistory.forEach(history => {
        // Optimization: Skip history days older than (startTime - 24h buffer)
        // detailed check allows accurate minute/hour precision
        history.viewers.forEach(viewer => {
             if (viewer.timestamp >= startTime) {
                 viewTimestamps.push(new Date(viewer.timestamp));
             }
        });
    });

    // Bucket views
    const viewsMap = new Map();
    
    // Initialize map with all intervals (Fill Gaps)
    let current = new Date(startTime);
    // Align current to start of interval
    if (interval === 'day') current.setHours(0,0,0,0);
    if (interval === 'hour') current.setMinutes(0,0,0);
    if (interval === 'minute') current.setSeconds(0,0);


    while (current <= now) {
        viewsMap.set(current.toISOString(), 0);
        
        // Increment
        if (interval === 'minute') current.setMinutes(current.getMinutes() + 1);
        else if (interval === 'hour') current.setHours(current.getHours() + 1);
        else current.setDate(current.getDate() + 1);
    }
    

    // Populate counts
    viewTimestamps.forEach(date => {
        let key = new Date(date);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();

        if (viewsMap.has(keyStr)) {
            viewsMap.set(keyStr, (viewsMap.get(keyStr) || 0) + 1);
        }
    });

    // Convert to Array
    const viewsTrend = Array.from(viewsMap, ([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));


    // 1.5 Likes & Comments Trends (Same logic as Views)
    const likesMap = new Map();
    const commentsMap = new Map();

    // Initialize with 0s
    viewTimestamps.forEach(date => { // Reuse bucket keys from views (efficient-ish) but safer to re-loop bounds if specific
       // Easier: Just re-loop buckets
    });
    // Re-create the empty map structure for all 3 for safety
    const allBuckets = new Map();
    let tempCurrent = new Date(startTime);
    // Align tempCurrent same as before
    if (interval === 'day') tempCurrent.setHours(0,0,0,0);
    if (interval === 'hour') tempCurrent.setMinutes(0,0,0);
    if (interval === 'minute') tempCurrent.setSeconds(0,0);

    while (tempCurrent <= now) {
        const iso = tempCurrent.toISOString();
        allBuckets.set(iso, { views: 0, likes: 0, comments: 0 });
        if (interval === 'minute') tempCurrent.setMinutes(tempCurrent.getMinutes() + 1);
        else if (interval === 'hour') tempCurrent.setHours(tempCurrent.getHours() + 1);
        else tempCurrent.setDate(tempCurrent.getDate() + 1);
    }
    
    // Fill Views (Redoing view fill here to be cleaner if you prefer, or just map separate)
    // Let's map separate maps for clarity in response, but loop efficient
    // Actually, distinct maps are easier for frontend Recharts if passed as arrays
    // BUT Recharts likes: [{date: '..', views: 5, likes: 2}, ...] for composed chart. 
    // So let's build a Combined Array!
    
    // 1. Fill Views
    viewTimestamps.forEach(date => {
        let key = new Date(date);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (allBuckets.has(keyStr)) {
            allBuckets.get(keyStr).views++;
        }
    });

    // 2. Fill Likes
    if (blog.likeHistory) { // Ensure schema update exists
        blog.likeHistory.forEach(like => {
            if (new Date(like.timestamp) >= startTime) {
                let key = new Date(like.timestamp);
                if (interval === 'day') key.setHours(0,0,0,0);
                else if (interval === 'hour') key.setMinutes(0,0,0);
                else if (interval === 'minute') key.setSeconds(0,0);
                
                const keyStr = key.toISOString();
                if (allBuckets.has(keyStr)) {
                   allBuckets.get(keyStr).likes++;
                }
            }
        });
    }

    // 3. Fill Comments
    // Need to fetch comments? We populated/fetched blog, but need deep populate or secondary fetch
    // Actually 'blog.comments' is array of IDs. We need timestamps.
    // Fetch comments using those IDs
    const commentsList = await Comment.find({ 
        _id: { $in: blog.comments },
        createdAt: { $gte: startTime }
    }).select('createdAt');

    commentsList.forEach(comment => {
        let key = new Date(comment.createdAt);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (allBuckets.has(keyStr)) {
           allBuckets.get(keyStr).comments++;
        }
    });

    // Transform to Array
    const mergedTrend = Array.from(allBuckets, ([date, counts]) => ({ 
        date, 
        views: counts.views,
        likes: counts.likes,
        comments: counts.comments
    })).sort((a, b) => new Date(a.date) - new Date(b.date));


    // 2. Country Stats
    const countryStats = {};
    const ageGroups = {
      '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0
    };

    blog.viewHistory.forEach(history => {
      history.viewers.forEach(viewer => {
        if (new Date(viewer.timestamp) >= startTime) {
            const country = viewer.country || "Unknown";
            countryStats[country] = (countryStats[country] || 0) + 1;

            if (viewer.userId && viewer.userId.dateOfBirth) {
                const dob = new Date(viewer.userId.dateOfBirth);
                const diff_ms = Date.now() - dob.getTime();
                const age_dt = new Date(diff_ms); 
                const age = Math.abs(age_dt.getUTCFullYear() - 1970);
                if (age >= 18 && age <= 24) ageGroups['18-24']++;
                else if (age >= 25 && age <= 34) ageGroups['25-34']++;
                else if (age >= 35 && age <= 44) ageGroups['35-44']++;
                else if (age >= 45 && age <= 54) ageGroups['45-54']++;
                else if (age >= 55) ageGroups['55+']++;
                else ageGroups['Unknown']++;
            } else {
                ageGroups['Unknown']++;
            }
        }
      });
    });

    const countryDistribution = Object.entries(countryStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const ageDistribution = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

    res.status(200).json({
      totalViews: blog.views,
      totalLikes: blog.likesCount,
      totalComments: blog.comments.length,
      periodViews: viewTimestamps.length,
      viewsTrend: mergedTrend, // Renamed but keeping key for frontend compatibility? No frontend expects viewsTrend.
                              // Wait, frontend expects `viewsTrend` array of {date, count, ...}
                              // We should pass `mergedTrend` but user code might expect just `viewsTrend`
                              // Let's pass `viewsTrend` but populate it with extra fields.
                              // Frontend uses `dataKey="count"`, we'll need to update Frontend too.
      countryDistribution,
      ageDistribution
    });

  } catch (error) {
    console.error("GET ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Like Blog
------------------------- */
export const likeBlog = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user._id || req.user.id;
        
        const blog = await Blog.findOne({ slug, isDeleted: false });
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        const isLiked = blog.likes.includes(userId);

        if (isLiked) {
            // Unliking
            blog.likes.pull(userId);
            blog.likesCount = Math.max(0, blog.likesCount - 1);
            // Optionally remove from likeHistory? Usually analytics keeps history even if unliked, 
            // but for "Current Status" we usually remove.
            // For strictly "Activity" graph, we shouldn't delete past actions. 
            // BUT if we just pull generic timestamp, we might lose *when* it was liked.
            // Let's leave history alone for now (Like activity happened). 
            // OR finding specific history entry is hard without unique ID for the action.
            // Simplified: Just update current state.
        } else {
            // Liking
            blog.likes.push(userId);
            blog.likesCount += 1;
            // Add to history
            blog.likeHistory.push({
                userId,
                timestamp: new Date()
            });
        }

        await blog.save();
        res.status(200).json({ success: true, likesCount: blog.likesCount, isLiked: !isLiked });
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
        const { content } = req.body;
        const userId = req.user._id || req.user.id;

        if (!content) return res.status(400).json({ message: "Content required" });

        const blog = await Blog.findOne({ slug, isDeleted: false });
        if (!blog) return res.status(404).json({ message: "Blog not found" });

        const comment = await Comment.create({
            content,
            blog: blog._id,
            author: userId
        });

        blog.comments.push(comment._id);
        await blog.save();
        
        // Populate author for immediate return
        await comment.populate("author", "fullname username profile_img");

        res.status(201).json({ success: true, comment });
    } catch (error) {
        console.error("ADD COMMENT ERROR", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getBlogComments = async (req, res) => {
    try {
         const { slug } = req.params;
         const blog = await Blog.findOne({ slug }).select("_id");
         if (!blog) return res.status(404).json({ message: "Blog not found" });

         const comments = await Comment.find({ blog: blog._id })
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
             // Allow blog owner to delete too? Optional. For now strict author.
             return res.status(403).json({ message: "Unauthorized" });
        }

        await Comment.findByIdAndDelete(commentId);
        // Also remove from Blog (optional but clean)
        await Blog.findByIdAndUpdate(comment.blog, { $pull: { comments: commentId } });

        res.status(200).json({ success: true, message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

/* ----------------------
   Get Blog for Editor (Drafts allowed)
------------------------- */
export const getBlogForEditor = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user._id || req.user.id; // From verifyAccessToken

    // Find blog by slug, allow deleted checking if needed, but definitely allow drafts
    const blog = await Blog.findOne({ slug, isDeleted: false })
      .populate("author", "name email avatar");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Check ownership
    // Convert to strings to ensure correct comparison
    if (blog.author._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not the author of this blog" });
    }

    // No caching here as we want fresh data for editing
    res.status(200).json(blog);
  } catch (error) {
    console.error("GET BLOG FOR EDITOR ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Track Blog View
------------------------- */
export const trackBlogView = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?._id || req.user?.id;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const geo = geoip.lookup(ip);
    const country = geo ? geo.country : "Unknown";

    const blog = await Blog.findOne({ slug, isDeleted: false, isPublished: true });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const userIdentifier = userId || ip;
    const cooldownKey = `cooldown:view:${blog._id}:${userIdentifier}`;
    
    // Check cooldown
    const hasCooldown = await redis.get(cooldownKey);
    if (hasCooldown) {
      return res.status(200).json({ message: "View already counted (cooldown)", views: blog.views });
    }

    const redisKey = `views:blog:${blog._id}`;
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

    res.status(200).json({ message: "View tracked", views: blog.views + 1 });
  } catch (error) {
    console.error("TRACK BLOG VIEW ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Update Blog
------------------------- */
export const updateBlog = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const blog = await Blog.findOne({ slug, isDeleted: false });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // author validation
    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const fields = ["title", "content", "tags", "category", "coverImage", "cardShape"];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) blog[field] = req.body[field];
    });

    await blog.save();

    res.status(200).json({
      message: "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("UPDATE BLOG ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Soft Delete Blog
------------------------- */
export const deleteBlog = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const blog = await Blog.findOne({ slug, isDeleted: false });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    blog.isDeleted = true;
    await blog.save();

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    console.error("DELETE BLOG ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Publish Blog
------------------------- */
export const publishBlog = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if user is authenticated
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const blog = await Blog.findOne({ slug, isDeleted: false });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (blog.isPublished) {
      return res.status(200).json({ message: "Already published", blog });
    }

    blog.isPublished = true;
    await blog.save();

    return res.status(200).json({ message: "Blog published successfully", blog });
  } catch (error) {
    console.error("PUBLISH BLOG ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Get User's Dashboard Blogs (Public & Private)
------------------------- */
export const getUserPublishedBlogs = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const blogs = await Blog.find({
      author: userId,
      isDeleted: false, // Return everything including drafts, but not deleted
    })
      .populate("author", "name email avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: blogs,
    });
  } catch (error) {
    console.error("GET USER DASHBOARD BLOGS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------
   Track Blog Impressions
------------------------- */
export const trackBlogImpressions = async (req, res) => {
  try {
    const { blogIds } = req.body;

    if (!blogIds || !Array.isArray(blogIds) || blogIds.length === 0) {
      return res.status(400).json({ message: "blogIds array required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const blogId of blogIds) {
      const redisKey = `impressions:blog:${blogId}`;
      await redis.incr(redisKey);
      await redis.expire(redisKey, 300);
    }

    res.status(200).json({ message: "Impressions tracked" });
  } catch (error) {
    console.error("TRACK BLOG IMPRESSIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
