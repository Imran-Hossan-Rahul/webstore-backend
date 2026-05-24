import Comment from "../models/Comment.model.js";
import Post from "../models/Post.model.js";
import Codex from "../models/Codex.model.js";
import Artifact from "../models/Artifact.model.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import GamificationService from "../services/GamificationService.js";

/**
 * @desc    Add a comment to a post or codex (Synchronous)
 * @route   POST /api/v1/comments/:postId
 * @access  Private
 */
export const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentComment, feedbackType = 'comment' } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({ success: false, message: "Comment content is required" });
    }

    // Determine if postId belongs to a Codex, Artifact, or Post
    const isCodex = await Codex.exists({ _id: postId, isDeleted: false });
    const isArtifact = !isCodex && await Artifact.exists({ _id: postId, isActive: true });
    
    const commentData = {
        author: userId,
        user: userId,
        content,
        feedbackType,
        parentComment: parentComment || null,
    };
    
    if (isCodex) {
        commentData.codex = postId;
    } else if (isArtifact) {
        commentData.artifact = postId;
    } else {
        commentData.post = postId;
    }

    // Create comment synchronously
    const newComment = await Comment.create(commentData);

    // Update parent model count + array reference
    const Model = isCodex ? Codex : isArtifact ? Artifact : Post;
    const parentDoc = await Model.findByIdAndUpdate(postId, {
        $inc: { commentsCount: 1 },
        $push: { comments: newComment._id }
    });

    // Award XP to the content owner for receiving a comment
    // Ensure we don't reward the user for commenting on their own post
    const ownerId = parentDoc?.author || parentDoc?.user;
    if (ownerId && ownerId.toString() !== userId.toString()) {
        await GamificationService.awardRewards(ownerId, 'GET_COMMENT').catch(err => 
            logger.error("Failed to award GET_COMMENT rewards:", err)
        );
    }

    // Populate for response
    await newComment.populate("author", "name avatar username profilePicture");

    const responseData = newComment.toObject();
    responseData.user = responseData.author;

    res.status(201).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error("Add Comment Error:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};

/**
 * @desc    Get comments for a post or codex
 * @route   GET /api/v1/comments/:postId
 * @access  Public
 */
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 300;
    const skip = (page - 1) * limit;

    // Query matches codex, artifact, and post comments
    const query = { $or: [{ post: postId }, { codex: postId }, { artifact: postId }] };

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name avatar username profilePicture")
      .lean();

    const transformed = comments.map(c => ({
        ...c,
        user: c.author
    }));

    const total = await Comment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformed,
      pagination: {
          total,
          page,
          hasMore: skip + comments.length < total
      }
    });

  } catch (error) {
    logger.error("Get Comments Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch comments" });
  }
};

/**
 * @desc    Toggle helpful status on a comment
 * @route   PATCH /api/v1/comments/:commentId/helpful
 * @access  Private (Post Owner Only)
 */
export const toggleHelpful = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isHelpful } = req.body;
    const userId = req.user._id;

    // Find the comment and populate post with user
    const comment = await Comment.findById(commentId).populate({
      path: 'post',
      select: 'user'
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    // Check if user is the post owner
    if (!comment.post || !comment.post.user) {
      return res.status(500).json({ success: false, message: "Post information missing" });
    }

    if (comment.post.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Only post owner can mark comments as helpful" });
    }

    // Update helpful status
    comment.isHelpful = isHelpful;
    await comment.save();

    res.status(200).json({
      success: true,
      data: { _id: comment._id, isHelpful: comment.isHelpful }
    });

  } catch (error) {
    logger.error("Toggle Helpful Error:", error);
    console.error("Toggle Helpful Error Details:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Failed to update helpful status" });
  }
};


