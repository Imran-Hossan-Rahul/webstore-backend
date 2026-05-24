import { favoriteQueue } from "../queues/favoriteQueue.js";
import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Codex from "../models/Codex.model.js";
import Artifact from "../models/Artifact.model.js";
import Job from "../models/Job.model.js";
import Challenge from "../models/Challenge.model.js";
import Note from "../models/Note.model.js";
import logger from "../utils/logger.js";

/**
 * Toggle Favorite (Add/Remove)
 * Uses Craftsman for writes.
 */
export const toggleFavorite = async (req, res) => {
  try {
    const { postId, itemType = 'Post' } = req.body;
    const userId = req.user._id;

    if (!postId) {
      return res.status(400).json({ success: false, message: "Item ID is required" });
    }

    const user = await User.findById(userId).select("favorites");
    const isFavorited = user.favorites.includes(postId);
    const action = isFavorited ? "remove" : "add";

    // Add to Queue
    await favoriteQueue.add("toggle-favorite", {
      postId,
      userId,
      action,
      itemType: itemType.charAt(0).toUpperCase() + itemType.slice(1).toLowerCase() // Normalize: Post, Codex, Artifact, Job, Challenge
    }, {
      removeOnComplete: true,
      attempts: 3
    });

    res.status(200).json({
      success: true,
      isFavorited: !isFavorited,
      message: isFavorited ? "Removed from favorites" : "Added to favorites"
    });

  } catch (error) {
    logger.error("Toggle Favorite Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle favorite" });
  }
};

/**
 * Get User Favorites
 * Fetches from multiple collections (Post, Codex, Artifact).
 */
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select("favorites");
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    const favoriteIds = user.favorites || [];

    // Fetch from all possible collections plus Notes
    const [posts, codex, artifacts, foundJobs, foundChallenges, notes] = await Promise.all([
      Post.find({ _id: { $in: favoriteIds } }).populate("user", "name username avatar profilePicture").lean(),
      Codex.find({ _id: { $in: favoriteIds } }).populate("author", "name username avatar profilePicture").lean(),
      Artifact.find({ _id: { $in: favoriteIds } }).populate("user", "name username avatar profilePicture").lean(),
      Job.find({ _id: { $in: favoriteIds } }).populate("patron", "name username avatar profilePicture").lean(),
      Challenge.find({ _id: { $in: favoriteIds } }).populate("craftsman", "name username avatar profilePicture").lean(),
      Note.find({ user: userId })
        .populate("codex", "title slug coverImage author")
        .populate("user", "name username avatar profilePicture")
        .lean()
    ]);

    // Tag each item with its type for the frontend
    const taggedPosts = posts.map(p => ({ ...p, type: 'devlog' }));
    const taggedCodex = codex.map(b => ({ 
        ...b, 
        type: 'codex',
        user: b.author // Normalize for the frontend SavedItemCard
    }));
    const taggedArtifacts = artifacts.map(t => ({ ...t, type: 'artifact' }));
    const taggedJobs = foundJobs.map(j => ({ 
        ...j, 
        type: 'job', 
        user: j.patron // Normalize for the frontend SavedItemCard
    }));
    const taggedChallenges = foundChallenges.map(c => ({ 
        ...c, 
        type: 'challenge',
        user: c.craftsman // Normalize for the frontend SavedItemCard
    }));
    const taggedNotes = notes.map(n => ({
        ...n,
        type: 'note'
    }));

    // Combine and maintain original order if possible, or just combine
    const allFavorites = [
        ...taggedNotes, // Notes first as they are recent snippets usually
        ...taggedPosts, 
        ...taggedCodex, 
        ...taggedArtifacts,
        ...taggedJobs,
        ...taggedChallenges
    ];

    // Optional: Sort by the order in user.favorites array
    const sortedFavorites = allFavorites.sort((a, b) => {
      return favoriteIds.indexOf(b._id) - favoriteIds.indexOf(a._id);
    });

    res.status(200).json({
      success: true,
      data: sortedFavorites
    });

  } catch (error) {
    logger.error("Get Favorites Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch favorites" });
  }
};

/**
 * Clear All Favorites
 */
export const clearFavorites = async (req, res) => {
  try {
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { $set: { favorites: [] } });
    
    res.status(200).json({
      success: true,
      message: "All favorites cleared successfully"
    });
  } catch (error) {
    logger.error("Clear Favorites Error:", error);
    res.status(500).json({ success: false, message: "Failed to clear favorites" });
  }
};

/**
 * Get Public User Favorites (Folders & Standalone Notes)
 */
export const getPublicUserFavorites = async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch public folders
    const FavoriteFolder = (await import("../models/FavoriteFolder.model.js")).default;
    const publicFolders = await FavoriteFolder.find({ user: targetUser._id, isPublic: true })
      .populate("items.itemId")
      .lean();

    // Fetch public notes
    const publicNotes = await Note.find({ user: targetUser._id, isPublic: true })
      .populate("codex", "title slug coverImage author")
      .populate("user", "name username avatar profilePicture")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        folders: publicFolders,
        notes: publicNotes
      }
    });
  } catch (error) {
    logger.error("Get Public User Favorites Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch public favorites" });
  }
};

/**
 * Toggle Folder Visibility
 */
export const toggleFolderVisibility = async (req, res) => {
  try {
    const { isPublic } = req.body;
    const FavoriteFolder = (await import("../models/FavoriteFolder.model.js")).default;
    
    const folder = await FavoriteFolder.findOne({ _id: req.params.id, user: req.user._id });
    if (!folder) {
      return res.status(404).json({ success: false, message: "Folder not found" });
    }

    folder.isPublic = isPublic !== undefined ? isPublic : !folder.isPublic;
    await folder.save();

    res.status(200).json({ success: true, data: folder });
  } catch (error) {
    logger.error("Toggle Folder Visibility Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle visibility" });
  }
};



