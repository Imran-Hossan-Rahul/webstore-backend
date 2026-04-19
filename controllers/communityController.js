import Activity from "../models/Activity.model.js";
import CommunityTask from "../models/CommunityTask.model.js";
import CollaborationRoom from "../models/CollaborationRoom.model.js";
import Discussion from "../models/Discussion.model.js";
import User from "../models/User.model.js";
import logger from "../utils/logger.js";
import { getIO } from "../utils/socketManager.js";

/**
 * @desc    Get real-time activity feed
 * @route   GET /api/v1/community/activities
 * @access  Private
 */
export const getActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const activities = await Activity.find({ isActive: true })
      .populate("user", "name profilePicture username")
      .populate("projectId", "title")
      .populate("taskId", "title")
      .populate("roomId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Activity.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        total,
        page,
        hasMore: skip + activities.length < total
      }
    });

  } catch (error) {
    logger.error("Get Activities Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activities" });
  }
};

/**
 * @desc    Create/update user activity
 * @route   POST /api/v1/community/activity
 * @access  Private
 */
export const updateActivity = async (req, res) => {
  try {
    const { type, title, description, projectId, taskId, roomId, metadata } = req.body;
    const userId = req.user._id || req.user.id;

    const activity = await Activity.create({
      user: userId,
      type,
      title,
      description,
      projectId,
      taskId,
      roomId,
      metadata
    });

    await activity.populate("user", "name profilePicture username");

    res.status(201).json({
      success: true,
      data: activity
    });

  } catch (error) {
    logger.error("Update Activity Error:", error);
    res.status(500).json({ success: false, message: "Failed to update activity" });
  }
};

/**
 * @desc    Get community tasks
 * @route   GET /api/v1/community/tasks
 * @access  Private
 */
export const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status = "open",
      tags,
      sortBy = "createdAt",
      sortOrder = -1
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isPublic: true };

    if (category) query.category = category;
    if (status) query.status = status;
    if (tags) query.tags = { $in: tags.split(",") };

    const tasks = await CommunityTask.find(query)
      .populate("creator", "name profilePicture username")
      .populate("collaborators", "name profilePicture username")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await CommunityTask.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page: parseInt(page),
        hasMore: skip + tasks.length < total
      }
    });

  } catch (error) {
    logger.error("Get Tasks Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch tasks" });
  }
};

/**
 * @desc    Create a community task
 * @route   POST /api/v1/community/tasks
 * @access  Private
 */
export const createTask = async (req, res) => {
  try {
    const { title, description, category, tags, priority, attachments, bounty } = req.body;
    const userId = req.user._id || req.user.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const task = await CommunityTask.create({
      creator: userId,
      title,
      description,
      category,
      tags: tags || [],
      priority: priority || "medium",
      attachments: attachments || [],
      bounty: bounty || {}
    });

    await task.populate("creator", "name profilePicture username");

    // Create activity
    await Activity.create({
      user: userId,
      type: "sharing_task",
      title: title,
      description: description,
      taskId: task._id
    });

    res.status(201).json({
      success: true,
      data: task
    });

  } catch (error) {
    logger.error("Create Task Error:", error);
    res.status(500).json({ success: false, message: "Failed to create task", error: error.message });
  }
};

/**
 * @desc    Add solution to a task
 * @route   POST /api/v1/community/tasks/:taskId/solutions
 * @access  Private
 */
export const addSolution = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content, type, attachments } = req.body;
    const userId = req.user._id || req.user.id;

    const task = await CommunityTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const solution = {
      author: userId,
      content,
      type: type || "solution",
      attachments: attachments || []
    };

    task.solutions.push(solution);
    await task.save();

    await task.populate("solutions.author", "name profilePicture username");

    res.status(201).json({
      success: true,
      data: task.solutions[task.solutions.length - 1]
    });

  } catch (error) {
    logger.error("Add Solution Error:", error);
    res.status(500).json({ success: false, message: "Failed to add solution" });
  }
};

/**
 * @desc    Get collaboration rooms
 * @route   GET /api/v1/community/rooms
 * @access  Private
 */
export const getRooms = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { type, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { isPublic: true },
        { participants: userId },
        { creator: userId }
      ]
    };

    if (type) query.type = type;

    const rooms = await CollaborationRoom.find(query)
      .populate("creator", "name profilePicture username")
      .populate("participants", "name profilePicture username")
      .populate("relatedTask", "title status")
      .populate("relatedProject", "title")
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await CollaborationRoom.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rooms,
      pagination: {
        total,
        page: parseInt(page),
        hasMore: skip + rooms.length < total
      }
    });

  } catch (error) {
    logger.error("Get Rooms Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rooms" });
  }
};

/**
 * @desc    Create collaboration room
 * @route   POST /api/v1/community/rooms
 * @access  Private
 */
export const createRoom = async (req, res) => {
  try {
    const { name, description, type, relatedTask, relatedProject, isPublic, tags } = req.body;
    const userId = req.user._id || req.user.id;

    const room = await CollaborationRoom.create({
      name,
      description,
      creator: userId,
      participants: [userId], // creator is automatically a participant
      type: type || "general",
      relatedTask,
      relatedProject,
      isPublic: isPublic !== undefined ? isPublic : true,
      tags: tags || []
    });

    await room.populate("creator", "name profilePicture username");

    res.status(201).json({
      success: true,
      data: room
    });

  } catch (error) {
    logger.error("Create Room Error:", error);
    res.status(500).json({ success: false, message: "Failed to create room" });
  }
};

/**
 * @desc    Join collaboration room
 * @route   POST /api/v1/community/rooms/:roomId/join
 * @access  Private
 */
export const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id || req.user.id;

    const room = await CollaborationRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (room.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: "Already a participant" });
    }

    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ success: false, message: "Room is full" });
    }

    room.participants.push(userId);
    await room.save();

    await room.populate("participants", "name profilePicture username");

    res.status(200).json({
      success: true,
      data: room
    });

  } catch (error) {
    logger.error("Join Room Error:", error);
    res.status(500).json({ success: false, message: "Failed to join room" });
  }
};

/**
 * @desc    Create discussion
 * @route   POST /api/v1/community/discussions
 * @access  Private
 */
export const createDiscussion = async (req, res) => {
  try {
    const { topic, description, category, tags } = req.body;
    const userId = req.user._id || req.user.id;

    const discussion = await Discussion.create({
      creator: userId,
      topic,
      description,
      category: category || "general",
      tags: tags || [],
      participants: [userId]
    });

    await discussion.populate("creator", "name profilePicture username");

    // Create activity
    await Activity.create({
      user: userId,
      type: "created_post",
      title: topic,
      description: description,
      metadata: { discussionId: discussion._id, postType: "discussion" }
    });

    res.status(201).json({ success: true, data: discussion });
  } catch (error) {
    logger.error("Create Discussion Error:", error);
    res.status(500).json({ success: false, message: "Failed to create discussion" });
  }
};

/**
 * @desc    Get discussions
 * @route   GET /api/v1/community/discussions
 * @access  Private
 */
export const getDiscussions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const discussions = await Discussion.find({ isActive: true })
      .populate("creator", "name profilePicture username")
      .populate("participants", "name profilePicture username")
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: discussions });
  } catch (error) {
    logger.error("Get Discussions Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch discussions" });
  }
};

/**
 * @desc    Add message to discussion
 * @route   POST /api/v1/community/discussions/:id/messages
 * @access  Private
 */
export const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, replyTo } = req.body;
    const userId = req.user._id || req.user.id;
    const files = req.files;

    if (!content && (!files || files.length === 0)) {
      return res.status(400).json({ success: false, message: "Message content or files required" });
    }

    const discussion = await Discussion.findById(id);
    if (!discussion) {
      return res.status(404).json({ success: false, message: "Discussion not found" });
    }

    const messageData = { author: userId, content: content || "", replyTo: replyTo || null };
    discussion.messages.push(messageData);
    
    // Update parent message replies array
    if (replyTo) {
      const parentMsg = discussion.messages.id(replyTo);
      if (parentMsg) {
        if (!parentMsg.replies) parentMsg.replies = [];
        parentMsg.replies.push(discussion.messages[discussion.messages.length - 1]._id);
      }
    }
    
    if (!discussion.participants.includes(userId)) {
      discussion.participants.push(userId);
    }
    
    await discussion.save();

    const message = discussion.messages[discussion.messages.length - 1];

    // Queue media uploads if files exist
    if (files && files.length > 0) {
      const { Queue } = await import("bullmq");
      const IORedis = (await import("ioredis")).default;
      const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
      const mediaQueue = new Queue("chat-media-upload", { connection });

      for (const file of files) {
        const mediaType = file.mimetype.startsWith("image/") ? "image" : 
                         file.mimetype.startsWith("video/") ? "video" : "file";
        
        await mediaQueue.add("upload-chat-media", {
          filePath: file.path,
          discussionId: id,
          messageId: message._id.toString(),
          mediaType,
          originalName: file.originalname
        });
      }
    }

    // Populate author for response
    await Discussion.populate(message, { path: 'author', select: 'name profilePicture username' });

    // Mark as read by author
    if (!message.readBy) message.readBy = [];
    message.readBy.push(userId);
    await discussion.save();

    // Emit real-time message to all users in discussion room
    const io = getIO();
    if (io) {
      io.to(`discussion_${id}`).emit("discussion:newMessage", {
        discussionId: id,
        message: message
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    logger.error("Add Message Error:", error);
    res.status(500).json({ success: false, message: "Failed to add message" });
  }
};

/**
 * @desc    Get discussion messages with pagination
 * @route   GET /api/v1/community/discussions/:id/messages
 * @access  Private
 */
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user._id || req.user.id;

    const discussion = await Discussion.findById(id)
      .select('messages')
      .slice('messages', [-limit - skip, limit])
      .populate("messages.author", "name profilePicture username")
      .lean();

    if (!discussion) {
      return res.status(404).json({ success: false, message: "Discussion not found" });
    }

    const totalMessages = await Discussion.findById(id).select('messageCount');

    // Calculate unread reply counts for each message
    const messagesWithUnread = discussion.messages.map(msg => {
      const unreadReplies = msg.replies ? msg.replies.filter(replyId => {
        const reply = discussion.messages.find(m => m._id.toString() === replyId.toString());
        return reply && (!reply.readBy || !reply.readBy.some(uid => uid.toString() === userId.toString()));
      }).length : 0;
      
      return {
        ...msg,
        replyCount: msg.replies?.length || 0,
        unreadReplyCount: unreadReplies
      };
    });

    res.status(200).json({ 
      success: true, 
      data: messagesWithUnread,
      hasMore: totalMessages.messageCount > (skip + limit),
      total: totalMessages.messageCount
    });
  } catch (error) {
    logger.error("Get Messages Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

/**
 * @desc    Mark message as read
 * @route   POST /api/v1/community/discussions/:id/messages/:messageId/read
 * @access  Private
 */
export const markMessageAsRead = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const userId = req.user._id || req.user.id;

    const discussion = await Discussion.findById(id);
    if (!discussion) {
      return res.status(404).json({ success: false, message: "Discussion not found" });
    }

    const message = discussion.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (!message.readBy) message.readBy = [];
    if (!message.readBy.some(uid => uid.toString() === userId.toString())) {
      message.readBy.push(userId);
      await discussion.save();
    }

    res.status(200).json({ success: true, message: "Message marked as read" });
  } catch (error) {
    logger.error("Mark Message Read Error:", error);
    res.status(500).json({ success: false, message: "Failed to mark message as read" });
  }
};
