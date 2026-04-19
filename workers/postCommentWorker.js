import { Worker } from "bullmq";
import redis from "../config/redis.js";
import mongoose from "mongoose";
import Comment from "../models/Comment.model.js";
import Post from "../models/Post.model.js";
import Blog from "../models/blog.model.js";




// ----------------------------
// Queue Events
// ----------------------------

// ----------------------------
// Worker
// ----------------------------
const worker = new Worker(
  "post-comment-queue",
  async (job) => {
    const { postId, userId, content, parentComment, itemType = "post" } = job.data;

    const commentData = {
      content,
      user: userId,
      author: userId, // Keeping both fields for compatibility if needed
      parentComment: parentComment || null
    };

    if (itemType === "blog") {
      commentData.blog = postId;
    } else {
      commentData.post = postId;
    }

    // Create Comment
    const newComment = await Comment.create(commentData);

    const Model = itemType === "blog" ? Blog : Post;

    // Update Comment Array and Count
    await Model.findByIdAndUpdate(postId, { 
      $inc: { commentsCount: 1 },
      $push: { comments: newComment._id } // Maintain array population
    });

    console.log(`Comment ${newComment._id} added to ${itemType} ${postId}`);

    // TODO: Trigger Notification Worker here if needed
    // notificationQueue.add("notify-comment", { ... })

    return { status: "done", commentId: newComment._id };
  },
  { connection: redis, concurrency: 30 }
);

console.log("🚀 Post Comment Worker Running...");
