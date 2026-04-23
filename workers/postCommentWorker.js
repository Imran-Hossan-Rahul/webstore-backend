import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Comment from "../models/Comment.model.js";
import Post from "../models/Post.model.js";
import Blog from "../models/blog.model.js";
import ButtonTemplate from "../models/Template.model.js";




// ----------------------------
// Queue Events
// ----------------------------

// ----------------------------
// Worker
// ----------------------------
const worker = new Worker(
  "post-comment-queue",
  async (job) => {
    const { postId, commentId, userId, content, parentComment, itemType = "post" } = job.data;

    // If commentId is provided, just update the parent model
    if (commentId) {
      const Model = itemType === "blog" ? Blog : itemType === "template" ? ButtonTemplate : Post;
      
      await Model.findByIdAndUpdate(postId, { 
        $inc: { commentsCount: 1 },
        $push: { comments: commentId }
      });

      console.log(`Comment ${commentId} linked to ${itemType} ${postId}`);
      return { status: "done", commentId };
    }

    // Legacy flow: Create comment in worker (for backward compatibility)
    const commentData = {
      content,
      user: userId,
      author: userId,
      parentComment: parentComment || null
    };

    if (itemType === "blog") {
      commentData.blog = postId;
    } else if (itemType === "template") {
      commentData.template = postId;
    } else {
      commentData.post = postId;
    }

    // Create Comment
    const newComment = await Comment.create(commentData);

    const Model = itemType === "blog" ? Blog : itemType === "template" ? ButtonTemplate : Post;

    // Update Comment Array and Count
    await Model.findByIdAndUpdate(postId, { 
      $inc: { commentsCount: 1 },
      $push: { comments: newComment._id }
    });

    console.log(`Comment ${newComment._id} added to ${itemType} ${postId}`);

    return { status: "done", commentId: newComment._id };
  },
  { connection: redis, concurrency: 30 }
);

console.log("🚀 Post Comment Worker Running...");
