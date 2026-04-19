import RecommendationService from "../services/RecommendationService.js";
import logger from "../utils/logger.js";

/**
 * @desc    Get aggregated and personalized feed (Templates + Blogs + Projects)
 * @route   GET /api/v1/feed
 * @access  Public (or Private)
 */
export const getFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type; // 'templates', 'blogs', 'projects'
    const userId = req.user ? (req.user._id || req.user.id) : null;

    logger.info(`Feed Request: User=${userId || 'Guest'}, Type=${type || 'Mixed'}, Page=${page}`);

    const result = await RecommendationService.getFeed(userId, page, limit, type);

    res.status(200).json({
        success: true,
        count: result.data.length,
        data: result.data,
        page,
        hasMore: result.hasMore
    });

  } catch (error) {
    logger.error("Feed Error:", error);
    res.status(500).json({ success: false, message: "Server Error fetching feed" });
  }
};

