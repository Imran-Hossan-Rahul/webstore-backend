import { Worker as Craftsman } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Comment from "../models/Comment.model.js";
import Post from "../models/Post.model.js";
import Codex from "../models/Codex.model.js";
import Artifact from "../models/Artifact.model.js";




// ----------------------------
// Queue Events
// ----------------------------

// ----------------------------
// Craftsman
// ----------------------------
const craftsman = new Craftsman(
  "post-comment-queue",
  async (job) => {
    const { postId, commentId, userId, content, parentComment, itemType = "post" } = job.data;

    // If commentId is provided, just update the parent model
    if (commentId) {
      const Model = itemType === "codex" ? Codex : itemType === "artifact" ? Artifact : Post;
      
      const updatedModel = await Model.findByIdAndUpdate(postId, { 
        $inc: { commentsCount: 1 },
        $push: { comments: commentId }
      }, { new: true });

      if (updatedModel) {
        const authorId = updatedModel.user || updatedModel.author || updatedModel.userId;
        if (authorId && authorId.toString() !== userId.toString()) {
           const GamificationService = (await import("../services/GamificationService.js")).default;
           await GamificationService.awardXP(authorId.toString(), 'GET_COMMENT');
        }
      }

      console.log(`Comment ${commentId} linked to ${itemType} ${postId}`);
      return { status: "done", commentId };
    }

    // Legacy flow: Create comment in craftsman (for backward compatibility)
    const commentData = {
      content,
      user: userId,
      author: userId,
      parentComment: parentComment || null
    };

    if (itemType === "codex") {
      commentData.codex = postId;
    } else if (itemType === "artifact") {
      commentData.artifact = postId;
    } else {
      commentData.post = postId;
    }

    // Create Comment
    const newComment = await Comment.create(commentData);

    const Model = itemType === "codex" ? Codex : itemType === "artifact" ? Artifact : Post;

    // Update Comment Array and Count
    const updatedModel = await Model.findByIdAndUpdate(postId, { 
      $inc: { commentsCount: 1 },
      $push: { comments: newComment._id }
    }, { new: true });

    if (updatedModel) {
      const authorId = updatedModel.user || updatedModel.author || updatedModel.userId;
      if (authorId && authorId.toString() !== userId.toString()) {
         const GamificationService = (await import("../services/GamificationService.js")).default;
         await GamificationService.awardXP(authorId.toString(), 'GET_COMMENT');
      }
    }

    console.log(`Comment ${newComment._id} added to ${itemType} ${postId}`);

    return { status: "done", commentId: newComment._id };
  },
  { connection: redis, concurrency: 30 }
);

console.log("ðŸš€ Post Comment Craftsman Running...");


