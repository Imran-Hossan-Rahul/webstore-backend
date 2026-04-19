import { favoriteQueue } from "../queues/favoriteQueue.js";
import User from "../models/User.model.js";
import Post from "../models/Post.model.js"; // Needed for populate if we fetch
import logger from "../utils/logger.js";

/**
 * Toggle Favorite (Add/Remove)
 * Uses Worker for writes.
 */
export const toggleFavorite = async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user._id;

    if (!postId) {
      return res.status(400).json({ success: false, message: "Post ID is required" });
    }

    // Check current state to determine action
    // Note: This is a synchronous check for optimistic UI logic, 
    // but typically we can just assume the client knows the state or send "toggle".
    // However, for the worker, explicit "add" or "remove" is safer.
    
    const user = await User.findById(userId).select("favorites");
    const isFavorited = user.favorites.includes(postId);
    const action = isFavorited ? "remove" : "add";

    // Add to Queue
    await favoriteQueue.add("toggle-favorite", {
      postId,
      userId,
      action
    }, {
      removeOnComplete: true,
      attempts: 3
    });

    res.status(200).json({
      success: true,
      isFavorited: !isFavorited, // Optimistic result
      message: isFavorited ? "Removed from favorites" : "Added to favorites"
    });

  } catch (error) {
    logger.error("Toggle Favorite Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle favorite" });
  }
};

/**
 * Get User Favorites
 * Fetches directly from DB (no worker needed for read).
 */
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).populate({
        path: 'favorites',
        populate: { path: 'user', select: 'name username avatar' } // Populate post author
    });

    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // Filter out null favorites (deleted posts)
    const validFavorites = user.favorites.filter(post => post !== null);

    res.status(200).json({
      success: true,
      data: validFavorites
    });

  } catch (error) {
    logger.error("Get Favorites Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch favorites" });
  }
};
