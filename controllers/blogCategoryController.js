import BlogCategory from "../models/BlogCategory.model.js";
import logger from "../utils/logger.js";
import redis from "../config/redis.js";

// @desc    Create a new blog category
// @route   POST /api/blogs/categories
// @access  Private (Admin/SuperAdmin)
export const createCategory = async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;

    const existingCategory = await BlogCategory.findOne({ slug });
    if (existingCategory) {
      return res.status(400).json({ success: false, message: "Category slug already exists" });
    }

    const category = await BlogCategory.create({
      name,
      slug,
      description,
      icon,
    });

    // Invalidate categories cache
    await redis.del("blogs:categories:all");

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    logger.error(`Error in createCategory: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// @desc    Get all active blog categories
// @route   GET /api/blogs/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const cacheKey = "blogs:categories:all";
    const cachedCategories = await redis.get(cacheKey);

    if (cachedCategories) {
      return res.status(200).json({ success: true, data: JSON.parse(cachedCategories) });
    }

    const categories = await BlogCategory.find({ isActive: true }).sort({ createdAt: -1 });

    await redis.set(cacheKey, JSON.stringify(categories), "EX", 3600); // Cache for 1 hour

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    logger.error(`Error in getCategories: ${error.message}`);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
