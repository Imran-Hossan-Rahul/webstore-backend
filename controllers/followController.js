import Follow from "../models/Follow.model.js";
import FollowHistory from "../models/FollowHistory.model.js";
import User from "../models/User.model.js";
import { notifyNewFollower } from "../utils/notificationHelper.js";

/**
 * @desc    Toggle Follow/Unfollow a user
 * @route   POST /api/v1/user/follow/:targetUserId
 * @access  Private
 */
export const toggleFollow = async (req, res) => {
  try {
    const followerId = req.user._id;
    const { targetUserId } = req.params;

    if (followerId.toString() === targetUserId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check existing follow relationship
    const existingFollow = await Follow.findOne({
      follower: followerId,
      following: targetUserId,
    });

    if (existingFollow) {
      // UNFOLLOW
      await Follow.deleteOne({ _id: existingFollow._id });

      // Record history
      await FollowHistory.create({
        follower: followerId,
        following: targetUserId,
        action: "unfollow",
      });

      return res.status(200).json({ 
          success: true, 
          action: "unfollow",
          message: `Unfollowed ${targetUser.name}` 
      });
    } else {
      // FOLLOW
      await Follow.create({
        follower: followerId,
        following: targetUserId,
      });

      // Record history
      await FollowHistory.create({
        follower: followerId,
        following: targetUserId,
        action: "follow",
      });

      // Send notification
      const follower = await User.findById(followerId).select("name username");
      const io = req.app.get("io");
      if (io) {
        await notifyNewFollower(io, targetUserId, followerId, follower?.name || follower?.username);
      }

      return res.status(200).json({ 
          success: true, 
          action: "follow", 
          message: `Followed ${targetUser.name}` 
      });
    }

  } catch (error) {
    console.error("Follow Toggle Error:", error);
    res.status(500).json({ message: "Server error processing follow request" });
  }
};

/**
 * @desc    Check if current user follows target
 * @route   GET /api/v1/user/follow-status/:targetUserId
 * @access  Private
 */
export const getFollowStatus = async (req, res) => {
    try {
        const followerId = req.user._id;
        const { targetUserId } = req.params;

        const isFollowing = await Follow.exists({
            follower: followerId,
            following: targetUserId
        });

        res.status(200).json({ isFollowing: !!isFollowing });
    } catch (error) {
        console.error("Follow Status Error:", error);
        res.status(500).json({ message: "Server error checking follow status" });
    }
};

/**
 * @desc    Get follow stats (followers/following counts)
 * @route   GET /api/v1/user/follow-stats/:userId
 * @access  Public
 */
export const getFollowStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const followersCount = await Follow.countDocuments({ following: userId });
        const followingCount = await Follow.countDocuments({ follower: userId });

        res.status(200).json({ 
            followers: followersCount, 
            following: followingCount 
        });
    } catch (error) {
        console.error("Follow Stats Error:", error);
        res.status(500).json({ message: "Server error fetching stats" });
    }
}

/**
 * @desc    Get list of users current user is following
 * @route   GET /api/v1/user/following
 * @access  Private
 */
export const getFollowing = async (req, res) => {
    try {
        const userId = req.user._id;

        const following = await Follow.find({ follower: userId })
            .populate('following', '_id name email profilePicture')
            .sort({ createdAt: -1 });

        const followingList = following.map(f => f.following);

        res.status(200).json({ 
            success: true,
            following: followingList 
        });
    } catch (error) {
        console.error("Get Following Error:", error);
        res.status(500).json({ message: "Server error fetching following list" });
    }
}
