// controllers/craftsmanController.js
import User from "../models/User.model.js";
import CraftsmanProfile from "../models/CraftsmanProfile.model.js";
import Codex from "../models/Codex.model.js";
import logger from "../utils/logger.js";
import { generateAccessToken } from "../services/auth.service.js";
import mongoose from "mongoose";

// @desc    Create craftsman account for authenticated user
// @route   POST /api/v1/craftsman/create
// @access  Private
export const createCraftsmanAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user already has craftsman account
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.hasCraftsmanAccount) {
      return res.status(400).json({
        success: false,
        message: "You already have a craftsman account",
      });
    }

    // Check if craftsman profile already exists
    const existingProfile = await CraftsmanProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Craftsman profile already exists",
      });
    }

    const { displayName, bio, skills, workType, portfolio, socialLinks } =
      req.body;

    // Create craftsman profile
    const craftsmanProfile = await CraftsmanProfile.create({
      userId,
      displayName: displayName || user.name,
      bio: bio || "",
      skills: skills || [],
      workType: workType || "solo",
      portfolio: portfolio || [],
      socialLinks: socialLinks || {},
    });

    // Update user
    user.hasCraftsmanAccount = true;
    user.craftsmanProfileId = craftsmanProfile._id;
    await user.save();

    // Generate new access token with updated hasCraftsmanAccount
    const newAccessToken = generateAccessToken(user);

    logger.info(`Craftsman account created for user: ${user.email}`);

    return res.status(201).json({
      success: true,
      message: "Craftsman account created successfully",
      data: {
        craftsmanProfile: {
          _id: craftsmanProfile._id,
          displayName: craftsmanProfile.displayName,
          bio: craftsmanProfile.bio,
          skills: craftsmanProfile.skills,
          workType: craftsmanProfile.workType,
          isActive: craftsmanProfile.isActive,
        },
        hasCraftsmanAccount: true,
        accessToken: newAccessToken, // New token with hasCraftsmanAccount=true
      },
    });
  } catch (err) {
    logger.error("Create Craftsman Account Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Get craftsman profile
// @route   GET /api/v1/craftsman/profile
// @access  Private
export const getCraftsmanProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const craftsmanProfile = await CraftsmanProfile.findOne({ userId });
    if (!craftsmanProfile) {
      return res.status(404).json({
        success: false,
        message: "Craftsman profile not found",
      });
    }

    // --- Aggregate real stats from Codex collection ---
    const [codexStats] = await Codex.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalCodex: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
        },
      },
    ]);

    // --- Aggregate artifact stats ---
    const Artifact = (await import("../models/Artifact.model.js")).default;
    const [artifactStats] = await Artifact.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
      {
        $group: {
          _id: null,
          totalArtifacts: { $sum: 1 },
          totalArtifactViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
          totalArtifactLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
          totalDownloads: { $sum: { $ifNull: ["$downloadsCount", 0] } },
        },
      },
    ]);

    const realStats = {
      totalCodex: codexStats?.totalCodex || 0,
      totalViews: (codexStats?.totalViews || 0) + (artifactStats?.totalArtifactViews || 0),
      totalLikes: (codexStats?.totalLikes || 0) + (artifactStats?.totalArtifactLikes || 0),
      totalArtifacts: artifactStats?.totalArtifacts || 0,
      totalDownloads: artifactStats?.totalDownloads || 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        ...craftsmanProfile.toObject(),
        totalCodex: realStats.totalCodex,
        totalViews: realStats.totalViews,
        totalLikes: realStats.totalLikes,
        totalArtifacts: realStats.totalArtifacts,
        totalDownloads: realStats.totalDownloads,
      },
    });
  } catch (err) {
    logger.error("Get Craftsman Profile Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Update craftsman profile
// @route   PATCH /api/v1/craftsman/profile
// @access  Private
export const updateCraftsmanProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const craftsmanProfile = await CraftsmanProfile.findOne({ userId });
    if (!craftsmanProfile) {
      return res.status(404).json({
        success: false,
        message: "Craftsman profile not found",
      });
    }

    const allowedUpdates = [
      "displayName",
      "bio",
      "skills",
      "workType",
      "portfolio",
      "socialLinks",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        craftsmanProfile[field] = req.body[field];
      }
    });

    await craftsmanProfile.save();

    return res.status(200).json({
      success: true,
      message: "Craftsman profile updated successfully",
      data: craftsmanProfile,
    });
  } catch (err) {
    logger.error("Update Craftsman Profile Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Delete craftsman account
// @route   DELETE /api/v1/craftsman/profile
// @access  Private
export const deleteCraftsmanAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    const craftsmanProfile = await CraftsmanProfile.findOne({ userId });
    if (!craftsmanProfile) {
      return res.status(404).json({
        success: false,
        message: "Craftsman profile not found",
      });
    }

    // Soft delete - deactivate instead of removing
    craftsmanProfile.isActive = false;
    await craftsmanProfile.save();

    // Update user
    const user = await User.findById(userId);
    user.hasCraftsmanAccount = false;
    await user.save();

    logger.info(`Craftsman account deactivated for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Craftsman account deactivated successfully",
    });
  } catch (err) {
    logger.error("Delete Craftsman Account Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Get public craftsman profile by userId
// @route   GET /api/v1/craftsman/:userId
// @access  Public (with optional auth for isFollowing state)
export const getPublicCraftsmanProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId is a valid ObjectId before querying
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // requesterId is available if the request has an auth token (optional)
    const requesterId = req.user?._id?.toString() || null;

    // --- Aggregate real stats from Codex collection ---
    const [codexStats] = await Codex.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalCodex: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
        },
      },
    ]);

    // --- Aggregate artifact stats ---
    const Artifact = (await import("../models/Artifact.model.js")).default;
    const [artifactStats] = await Artifact.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
      {
        $group: {
          _id: null,
          totalArtifacts: { $sum: 1 },
          totalArtifactViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
          totalArtifactLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
          totalDownloads: { $sum: { $ifNull: ["$downloadsCount", 0] } },
        },
      },
    ]);

    const realStats = {
      totalCodex: codexStats?.totalCodex || 0,
      totalViews: (codexStats?.totalViews || 0) + (artifactStats?.totalArtifactViews || 0),
      totalLikes: (codexStats?.totalLikes || 0) + (artifactStats?.totalArtifactLikes || 0),
      totalArtifacts: artifactStats?.totalArtifacts || 0,
      totalDownloads: artifactStats?.totalDownloads || 0,
    };

    // --- Fetch latest reviews ---
    const Review = (await import("../models/Review.model.js")).default;
    const latestReviews = await Review.find({ revieweeId: userId })
      .populate("reviewerId", "name profilePicture username")
      .sort({ createdAt: -1 })
      .limit(5);

    // --- First try full craftsman profile ---
    const craftsmanProfile = await CraftsmanProfile.findOne({
      userId,
      isActive: true,
    }).populate("userId", "name email profilePicture username createdAt followers following");

    if (craftsmanProfile) {
      const targetUser = await User.findById(userId).select("followers following");
      const followerCount = targetUser?.followers?.length || 0;
      const followingCount = targetUser?.following?.length || 0;
      
      // Fix: Convert both to string for proper comparison
      const isFollowing = requesterId && targetUser?.followers
        ? targetUser.followers.some((id) => id.toString() === requesterId.toString())
        : false;

      console.log('Follow Check (Full Craftsman):', { requesterId, followers: targetUser?.followers?.map(id => id.toString()), isFollowing });

      return res.status(200).json({
        success: true,
        data: {
          ...craftsmanProfile.toObject(),
          totalCodex: realStats.totalCodex,
          totalViews: realStats.totalViews,
          totalLikes: realStats.totalLikes,
          totalArtifacts: realStats.totalArtifacts,
          totalDownloads: realStats.totalDownloads,
          followerCount,
          followingCount,
          latestReviews,
        },
        isFullCraftsman: true,
        isFollowing: !!isFollowing,
        followerCount,
      });
    }

    // --- Fallback: basic user info ---
    const user = await User.findById(userId).select(
      "name email profilePicture username bio skills createdAt followers following"
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "Craftsman not found" });
    }

    const followerCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    
    // Fix: Convert both to string for proper comparison
    const isFollowing = requesterId && user.followers
      ? user.followers.some((id) => id.toString() === requesterId.toString())
      : false;

    console.log('Follow Check (Fallback):', { requesterId, followers: user.followers?.map(id => id.toString()), isFollowing });

    const syntheticProfile = {
      _id: user._id,
      displayName: user.name,
      bio: user.bio || "",
      profilePicture: user.profilePicture || "",
      coverPicture: "",
      skills: user.skills || [],
      socialLinks: {},
      totalCodex: realStats.totalCodex,
      totalViews: realStats.totalViews,
      totalLikes: realStats.totalLikes,
      totalArtifacts: realStats.totalArtifacts,
      totalDownloads: realStats.totalDownloads,
      followerCount,
      followingCount,
      isVerified: false,
      latestReviews,
      userId: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    };

    return res.status(200).json({
      success: true,
      data: syntheticProfile,
      isFullCraftsman: false,
      isFollowing: !!isFollowing,
      followerCount,
    });
  } catch (err) {
    logger.error("Get Public Craftsman Profile Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// @desc    Follow a user
// @route   POST /api/v1/craftsman/:userId/follow
// @access  Private
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user._id.toString();

    if (requesterId === userId) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }

    const [targetUser, requester] = await Promise.all([
      User.findById(userId),
      User.findById(requesterId),
    ]);

    if (!targetUser || !requester) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const alreadyFollowing = targetUser.followers.some(
      (id) => id.toString() === requesterId
    );

    if (alreadyFollowing) {
      // Unfollow
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== requesterId
      );
      requester.following = requester.following.filter(
        (id) => id.toString() !== userId
      );
      await Promise.all([targetUser.save(), requester.save()]);
      return res.status(200).json({
        success: true,
        isFollowing: false,
        followerCount: targetUser.followers.length,
        message: "Unfollowed successfully",
      });
    } else {
      // Follow
      targetUser.followers.push(requesterId);
      requester.following.push(userId);
      await Promise.all([targetUser.save(), requester.save()]);
      return res.status(200).json({
        success: true,
        isFollowing: true,
        followerCount: targetUser.followers.length,
        message: "Followed successfully",
      });
    }
  } catch (err) {
    logger.error("Follow User Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


