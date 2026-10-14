import Blog from "../models/Blog.model.js";
import logger from "../utils/logger.js";
import redis from "../config/redis.js";

// Helper function to invalidate cache
const invalidateBlogCache = async () => {
  const keys = await redis.keys("blogs:list:*");
  if (keys.length > 0) {
    await redis.del(keys);
  }
};

// @desc    Create a new blog
// @route   POST /api/blogs
// @access  Private (Admin/Author)
export const createBlog = async (req, res) => {
  try {
    let { slug, category, tags, en, bn, status, coverImage, coverImageAlt } = req.body;

    // Fix: empty category string causes Mongoose CastError
    if (!category || category.trim() === "") {
      category = undefined;
    }

    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      return res.status(400).json({ success: false, message: "Blog slug already exists" });
    }

    const availableLanguages = [];
    if (en?.title && en?.content) availableLanguages.push('en');
    if (bn?.title && bn?.content) availableLanguages.push('bn');

    const publishedAt = status === "published" ? new Date() : null;

    const blog = await Blog.create({
      slug,
      author: req.user._id, // Assumes auth middleware sets req.user
      category,
      tags,
      en,
      bn,
      availableLanguages,
      status,
      publishedAt,
      coverImage,
      coverImageAlt,
    });

    if (status === "published") {
      await invalidateBlogCache();
    }

    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    logger.error(`Error in createBlog: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get all published blogs (Public, paginated, cached)
// @route   GET /api/blogs
// @access  Public
export const getBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const lang = req.query.lang || "en";
    const category = req.query.category;
    const search = req.query.search;

    const skip = (page - 1) * limit;

    const cacheKey = `blogs:list:${lang}:page:${page}:limit:${limit}:cat:${category || 'all'}:search:${search || 'none'}`;
    const cachedBlogs = await redis.get(cacheKey);

    if (cachedBlogs) {
      return res.status(200).json({ success: true, ...JSON.parse(cachedBlogs) });
    }

    let query = { status: "published" };
    if (category) query.category = category;
    if (search) {
      query.$text = { $search: search };
    }

    // Select only the requested language + general fields
    const selectFields = `slug author category tags availableLanguages status publishedAt coverImage coverImageAlt views readTime ${lang}`;

    const blogs = await Blog.find(query)
      .populate("author", "name username profilePicture")
      .populate("category", "name slug")
      .select(selectFields)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Blog.countDocuments(query);

    const responseData = {
      data: blogs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800); // Cache for 30 mins

    res.status(200).json({ success: true, ...responseData });
  } catch (error) {
    logger.error(`Error in getBlogs: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get single blog by slug (Public, cached)
// @route   GET /api/blogs/:slug
// @access  Public
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const lang = req.query.lang || "en";

    const cacheKey = `blog:single:${slug}:${lang}`;
    const cachedBlog = await redis.get(cacheKey);

    if (cachedBlog) {
      return res.status(200).json({ success: true, data: JSON.parse(cachedBlog) });
    }

    const selectFields = `slug author category tags availableLanguages status publishedAt coverImage coverImageAlt views readTime likesCount ${lang}`;

    const blog = await Blog.findOne({ slug, status: "published" })
      .populate("author", "name username profilePicture bio")
      .populate("category", "name slug icon")
      .select(selectFields)
      .lean();

    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    await redis.set(cacheKey, JSON.stringify(blog), "EX", 3600); // Cache for 1 hour

    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    logger.error(`Error in getBlogBySlug: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Increment Blog View with Cooldown
// @route   POST /api/blogs/:slug/view
// @access  Public
export const incrementBlogView = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Identify actor (user or IP)
    const userId = req.user?._id?.toString() || null;
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const actor = userId || ip;

    // Cooldown check (60 seconds)
    const cooldownKey = `blogs:views:cooldown:${slug}:${actor}`;
    const set = await redis.set(cooldownKey, "1", "NX", "EX", 60);

    if (!set) {
      return res.status(200).json({ success: true, counted: false, message: "Cooldown active" });
    }

    // Since we don't have the _id easily without a DB call, we could update by slug
    // But direct DB increment here for simplicity. (In a 200k scale, use Redis incr then cron job)
    const countKey = `blogs:views:count:${slug}`;
    await redis.incr(countKey);
    
    // Background async update to MongoDB
    Blog.findOneAndUpdate({ slug }, { $inc: { views: 1 } }).exec();

    res.status(200).json({ success: true, counted: true });
  } catch (error) {
    logger.error(`Error in incrementBlogView: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
