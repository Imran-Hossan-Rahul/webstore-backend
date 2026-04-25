// controllers/creatorController.js
import User from "../models/User.model.js";
import CreatorProfile from "../models/CreatorProfile.model.js";
import Blog from "../models/blog.model.js";
import logger from "../utils/logger.js";
import { generateAccessToken } from "../services/auth.service.js";
import mongoose from "mongoose";

// @desc    Create creator account for authenticated user
// @route   POST /api/v1/creator/create
// @access  Private
export const createCreatorAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user already has creator account
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.hasCreatorAccount) {
      return res.status(400).json({
        success: false,
        message: "You already have a creator account",
      });
    }

    // Check if creator profile already exists
    const existingProfile = await CreatorProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Creator profile already exists",
      });
    }

    const { displayName, bio, skills, workType, portfolio, socialLinks } =
      req.body;

    // Create creator profile
    const creatorProfile = await CreatorProfile.create({
      userId,
      displayName: displayName || user.name,
      bio: bio || "",
      skills: skills || [],
      workType: workType || "solo",
      portfolio: portfolio || [],
      socialLinks: socialLinks || {},
    });

    // Update user
    user.hasCreatorAccount = true;
    user.creatorProfileId = creatorProfile._id;
    await user.save();

    // Generate new access token with updated hasCreatorAccount
    const newAccessToken = generateAccessToken(user);

    logger.info(`Creator account created for user: ${user.email}`);

    return res.status(201).json({
      success: true,
      message: "Creator account created successfully",
      data: {
        creatorProfile: {
          _id: creatorProfile._id,
          displayName: creatorProfile.displayName,
          bio: creatorProfile.bio,
          skills: creatorProfile.skills,
          workType: creatorProfile.workType,
          isActive: creatorProfile.isActive,
        },
        hasCreatorAccount: true,
        accessToken: newAccessToken, // New token with hasCreatorAccount=true
      },
    });
  } catch (err) {
    logger.error("Create Creator Account Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Get creator profile
// @route   GET /api/v1/creator/profile
// @access  Private
export const getCreatorProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const creatorProfile = await CreatorProfile.findOne({ userId });
    if (!creatorProfile) {
      return res.status(404).json({
        success: false,
        message: "Creator profile not found",
      });
    }

    // --- Aggregate real stats from Blog collection ---
    const [blogStats] = await Blog.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalBlogs: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
        },
      },
    ]);

    // --- Aggregate template stats ---
    const ButtonTemplate = (await import("../models/Template.model.js")).default;
    const [templateStats] = await ButtonTemplate.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
      {
        $group: {
          _id: null,
          totalTemplates: { $sum: 1 },
          totalTemplateViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
          totalTemplateLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
          totalDownloads: { $sum: { $ifNull: ["$downloadsCount", 0] } },
        },
      },
    ]);

    const realStats = {
      totalBlogs: blogStats?.totalBlogs || 0,
      totalViews: (blogStats?.totalViews || 0) + (templateStats?.totalTemplateViews || 0),
      totalLikes: (blogStats?.totalLikes || 0) + (templateStats?.totalTemplateLikes || 0),
      totalTemplates: templateStats?.totalTemplates || 0,
      totalDownloads: templateStats?.totalDownloads || 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        ...creatorProfile.toObject(),
        totalBlogs: realStats.totalBlogs,
        totalViews: realStats.totalViews,
        totalLikes: realStats.totalLikes,
        totalTemplates: realStats.totalTemplates,
        totalDownloads: realStats.totalDownloads,
      },
    });
  } catch (err) {
    logger.error("Get Creator Profile Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Update creator profile
// @route   PATCH /api/v1/creator/profile
// @access  Private
export const updateCreatorProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const creatorProfile = await CreatorProfile.findOne({ userId });
    if (!creatorProfile) {
      return res.status(404).json({
        success: false,
        message: "Creator profile not found",
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
        creatorProfile[field] = req.body[field];
      }
    });

    await creatorProfile.save();

    return res.status(200).json({
      success: true,
      message: "Creator profile updated successfully",
      data: creatorProfile,
    });
  } catch (err) {
    logger.error("Update Creator Profile Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Deactivate creator account
// @route   DELETE /api/v1/creator/account
// @access  Private
export const deleteCreatorAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    const creatorProfile = await CreatorProfile.findOne({ userId });
    if (!creatorProfile) {
      return res.status(404).json({
        success: false,
        message: "Creator profile not found",
      });
    }

    // Soft delete - deactivate instead of removing
    creatorProfile.isActive = false;
    await creatorProfile.save();

    // Update user
    const user = await User.findById(userId);
    user.hasCreatorAccount = false;
    await user.save();

    logger.info(`Creator account deactivated for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Creator account deactivated successfully",
    });
  } catch (err) {
    logger.error("Delete Creator Account Error: ", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc    Get public creator profile by userId
// @route   GET /api/v1/creator/:userId
// @access  Public (with optional auth for isFollowing state)
export const getPublicCreatorProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId is a valid ObjectId before querying
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // requesterId is available if the request has an auth token (optional)
    const requesterId = req.user?._id?.toString() || null;

    // --- Aggregate real stats from Blog collection ---
    const [blogStats] = await Blog.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalBlogs: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
        },
      },
    ]);

    // --- Aggregate template stats ---
    const ButtonTemplate = (await import("../models/Template.model.js")).default;
    const [templateStats] = await ButtonTemplate.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
      {
        $group: {
          _id: null,
          totalTemplates: { $sum: 1 },
          totalTemplateViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
          totalTemplateLikes: { $sum: { $ifNull: ["$likeCount", 0] } },
          totalDownloads: { $sum: { $ifNull: ["$downloadsCount", 0] } },
        },
      },
    ]);

    const realStats = {
      totalBlogs: blogStats?.totalBlogs || 0,
      totalViews: (blogStats?.totalViews || 0) + (templateStats?.totalTemplateViews || 0),
      totalLikes: (blogStats?.totalLikes || 0) + (templateStats?.totalTemplateLikes || 0),
      totalTemplates: templateStats?.totalTemplates || 0,
      totalDownloads: templateStats?.totalDownloads || 0,
    };

    // --- First try full creator profile ---
    const creatorProfile = await CreatorProfile.findOne({
      userId,
      isActive: true,
    }).populate("userId", "name email profilePicture username createdAt followers following");

    if (creatorProfile) {
      const targetUser = await User.findById(userId).select("followers following");
      const followerCount = targetUser?.followers?.length || 0;
      const followingCount = targetUser?.following?.length || 0;
      
      // Fix: Convert both to string for proper comparison
      const isFollowing = requesterId && targetUser?.followers
        ? targetUser.followers.some((id) => id.toString() === requesterId.toString())
        : false;

      console.log('Follow Check (Full Creator):', { requesterId, followers: targetUser?.followers?.map(id => id.toString()), isFollowing });

      return res.status(200).json({
        success: true,
        data: {
          ...creatorProfile.toObject(),
          totalBlogs: realStats.totalBlogs,
          totalViews: realStats.totalViews,
          totalLikes: realStats.totalLikes,
          totalTemplates: realStats.totalTemplates,
          totalDownloads: realStats.totalDownloads,
          followerCount,
          followingCount,
        },
        isFullCreator: true,
        isFollowing: !!isFollowing,
        followerCount,
      });
    }

    // --- Fallback: basic user info ---
    const user = await User.findById(userId).select(
      "name email profilePicture username bio skills createdAt followers following"
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "Creator not found" });
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
      totalBlogs: realStats.totalBlogs,
      totalViews: realStats.totalViews,
      totalLikes: realStats.totalLikes,
      totalTemplates: realStats.totalTemplates,
      totalDownloads: realStats.totalDownloads,
      followerCount,
      followingCount,
      isVerified: false,
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
      isFullCreator: false,
      isFollowing: !!isFollowing,
      followerCount,
    });
  } catch (err) {
    logger.error("Get Public Creator Profile Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// @desc    Follow a user
// @route   POST /api/v1/creator/:userId/follow
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
