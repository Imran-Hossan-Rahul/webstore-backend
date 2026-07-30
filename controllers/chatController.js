import mongoose from "mongoose";
import Chat from "../models/Chat.model.js";
import Message from "../models/Message.model.js";
import User from "../models/User.model.js";
import { createNotification } from "./notificationController.js";
import { chatMediaQueue } from "../queues/chatMediaQueue.js";
import { chatMessageQueue } from "../queues/chatMessageQueue.js";
import { getIO } from "../utils/socketManager.js";

// Get all users for chat list
export const getUsers = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId);
    
    let query = { _id: { $ne: userId } };
    if (currentUser && currentUser.role !== 'admin') {
      query.role = 'admin';
    }

    const users = await User.find(query)
      .select("username name email profilePicture role createdAt lastActiveAt")
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or get Support Chat
export const getOrCreateSupportChat = async (req, res) => {
  try {
    const currentUserId = req.user._id || req.user.id;
    
    let chat = await Chat.findOne({
      participants: currentUserId,
      isSupportChat: true
    }).populate("participants", "username name email profilePicture role lastActiveAt");

    if (!chat) {
      chat = await Chat.create({
        participants: [currentUserId],
        isSupportChat: true
      });
      chat = await chat.populate("participants", "username name email profilePicture role lastActiveAt");
    }

    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get or create chat between two users
export const getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id || req.user.id;

    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, userId] }
    }).populate("participants", "username name email profilePicture role lastActiveAt");

    const targetUser = await User.findById(userId).select("privacySettings name username followers role");
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

    const currentUser = await User.findById(currentUserId);
    if (currentUser && currentUser.role !== 'admin' && targetUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: "You can only chat with support admins." });
    }

    const privacy = targetUser.privacySettings || {};

    // ── 1. Messaging Permission Check ────────────────────────────────────────
    if (!chat) {
       if (privacy.whoCanMessage === "nobody") {
         return res.status(403).json({ success: false, message: `${targetUser.name} has disabled direct messages.` });
       }
       if (privacy.whoCanMessage === "followers") {
         // Followers model deleted, block it by default
         return res.status(403).json({ success: false, message: `Only followers can message ${targetUser.name}, but followers feature is disabled.` });
       }
    }

    if (!chat) {
      chat = await Chat.create({
        participants: [currentUserId, userId]
      });
      chat = await chat.populate("participants", "username name email profilePicture role lastActiveAt");
    }

    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all chats for current user
export const getUserChats = async (req, res) => {
  try {
    const rawUserId = req.user._id || req.user.id;
    const userObjId = new mongoose.Types.ObjectId(rawUserId);
    const currentUser = await User.findById(rawUserId);

    let query = { participants: rawUserId };
    if (currentUser && currentUser.role === 'admin') {
      query = { $or: [{ participants: rawUserId }, { isSupportChat: true }] };
    }

    const chats = await Chat.find(query)
      .populate("participants", "username name email profilePicture role lastActiveAt")
      .populate("lastMessage.sender", "username name")
      .sort({ updatedAt: -1 })
      .lean();

    const chatIds = chats.map(c => c._id);
    const unreadCounts = await Message.aggregate([
      { 
        $match: { 
          chatId: { $in: chatIds }, 
          sender: { $ne: userObjId }, 
          readBy: { $ne: userObjId } 
        } 
      },
      { $group: { _id: "$chatId", count: { $sum: 1 } } }
    ]);

    const unreadMap = new Map(unreadCounts.map(u => [u._id.toString(), u.count]));

    const chatsWithUnread = chats.map(chat => ({
      ...chat,
      unreadCount: unreadMap.get(chat._id.toString()) || 0
    }));

    res.json({ success: true, chats: chatsWithUnread });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get messages for a specific chat
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("participants", "username name email profilePicture role lastActiveAt");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Check if user is participant
    const userId = req.user._id || req.user.id;
    const currentUser = await User.findById(userId);
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    const isParticipant = chat.participants.some(p => p._id.toString() === userId.toString());
    if (!isParticipant && !(isAdmin && chat.isSupportChat)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const messages = await Message.find({ chatId })
      .populate("sender", "username name profilePicture")
      .populate("reactions.user", "username name")
      .sort({ createdAt: 1 })
      .lean();

    // ── 3. Read Receipts Privacy Check ──────────────────────────────────────
    const participantsWithPrivacy = await User.find({
      _id: { $in: chat.participants.map(p => p._id) }
    }).select("privacySettings");

    const privacyMap = new Map(
      participantsWithPrivacy.map(p => [p._id.toString(), p.privacySettings?.readReceipts !== false])
    );

    const filteredMessages = messages
      .filter(msg => !msg.deletedFor || !msg.deletedFor.some(id => id.toString() === userId.toString()))
      .map(msg => ({
        ...msg,
        readBy: (msg.readBy || []).filter(readerId => {
          const readerIdStr = readerId.toString();
          // Always show to the person who read it
          if (readerIdStr === userId.toString()) return true;
          // Otherwise check their privacy setting
          return privacyMap.get(readerIdStr);
        })
      }));

    res.json({ success: true, messages: filteredMessages, chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, type = "text", fileUrl, fileName } = req.body;

    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ success: false, message: "Unauthorized - User not authenticated" });
    }

    const userId = req.user._id || req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Check if user is participant
    const userIdStr = userId.toString();
    const currentUser = await User.findById(userId);
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    const isParticipant = chat.participants.some(p => p.toString() === userIdStr);
    
    if (!isParticipant && !(isAdmin && chat.isSupportChat)) {
      return res.status(403).json({ success: false, message: "You are not a participant of this chat" });
    }

    // ── 2. Real-time Messaging Privacy Check ────────────────────────────────
    const recipientId = chat.participants.find(p => p.toString() !== userIdStr);
    if (recipientId) {
      const recipient = await User.findById(recipientId).select("privacySettings");
      const rPrivacy = recipient?.privacySettings || {};
      
      if (rPrivacy.whoCanMessage === "nobody") {
        return res.status(403).json({ success: false, message: "This user has disabled messages." });
      }
      if (rPrivacy.whoCanMessage === "followers") {
        return res.status(403).json({ success: false, message: "Only followers can message this user, but followers feature is disabled." });
      }
    }

    const newMessageParams = {
      chatId,
      sender: userId,
      content,
      type,
    };

    if (fileUrl) newMessageParams.fileUrl = fileUrl;
    if (fileName) newMessageParams.fileName = fileName;

    const newMessage = await Message.create(newMessageParams);

    chat.lastMessage = {
      content: type === "text" ? content : `Sent a ${type}`,
      sender: userId,
      createdAt: newMessage.createdAt
    };
    chat.updatedAt = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username name profilePicture");

    // ── Fast path: emit to connected patrons immediately ──────────────────
    const io = getIO();
    if (io) {
      io.to(chatId).emit("message:new", populatedMessage);

      // ── Delivery tracking: if recipient is online, mark as delivered instantly ──
      const onlineUsers = global.__onlineUsers;
      const recipientParticipantId = chat.participants.find(p => p.toString() !== userIdStr);
      if (recipientParticipantId && onlineUsers) {
        const recipientIdStr = recipientParticipantId.toString();
        const recipientSocketId = onlineUsers.get(recipientIdStr);
        if (recipientSocketId) {
          // Recipient is online — mark delivered immediately
          await Message.findByIdAndUpdate(newMessage._id, {
            $addToSet: { deliveredTo: recipientParticipantId }
          });
          
          // Mutate the object in memory so the HTTP response includes this status
          populatedMessage.deliveredTo = [recipientParticipantId];
          
          // Notify sender that message was delivered
          const senderSockets = onlineUsers.get(userIdStr);
          if (senderSockets) {
            senderSockets.forEach(socketId => {
              io.to(socketId).emit("message:delivered", {
                messageId: newMessage._id.toString(),
                chatId,
              });
            });
          }
        }
      }

      chat.participants.forEach((participantId) => {
        if (participantId.toString() !== userIdStr) {
          io.emit(`user:${participantId}:newMessage`, { chatId, message: populatedMessage });
        }
      });
      
      // Support Chat broadcast to all admins
      if (chat.isSupportChat) {
        io.to("admins_room").emit("global:support:newMessage", { chatId, message: populatedMessage });
      }
    }

    // ── Slow path: enqueue fan-out (notifications for offline users) ──────
    await chatMessageQueue.add("fan-out", {
      chatId,
      messageId: newMessage._id.toString(),
      senderId: userIdStr,
      participantIds: chat.participants.map(p => p.toString()),
      content,
      type,
    });

    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.user._id || req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    await Message.updateMany(
      { chatId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    // ── Emit read-receipt to the other participant (sender) ──────────────
    const io = getIO();
    if (io) {
      // Notify everyone in the chat room that messages were read
      io.to(chatId).emit("message:seen", { chatId, readerId: userId.toString() });
      io.emit(`user:${userId}:chatRead`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload media file for a chat (Queue-based — files go to Cloudinary via craftsman)
export const uploadMedia = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = req.user._id || req.user.id;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

    const currentUser = await User.findById(userId);
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isParticipant = chat.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant && !(isAdmin && chat.isSupportChat)) return res.status(403).json({ success: false, message: "Unauthorized" });

    const isImage = req.file.mimetype.startsWith("image/");
    const fileType = isImage ? "image" : "file";

    // ── Temp URL for immediate display (will be replaced by Cloudinary URL) ─
    const backendBase = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const tempFileUrl = `${backendBase}/uploads/chat/${req.file.filename}`;

    // ── Create Message document immediately (fast path) ────────────────────
    const newMessage = await Message.create({
      chatId,
      sender: userId,
      content: req.file.originalname,
      type: fileType,
      fileUrl: tempFileUrl,   // temp — craftsman will replace with Cloudinary URL
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

    chat.lastMessage = {
      content: `Sent a ${fileType}`,
      sender: userId,
      createdAt: newMessage.createdAt,
    };
    chat.updatedAt = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username name profilePicture");

    // ── Emit immediately so UI shows the file now ──────────────────────────
    const io = req.app.get("io");
    if (io) {
      io.to(chatId).emit("message:new", populatedMessage);
      chat.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          io.emit(`user:${participantId}:newMessage`, { chatId, message: populatedMessage });
        }
      });
    }

    // ── Respond to patron immediately — don't wait for Cloudinary ──────────
    res.json({ success: true, message: populatedMessage });

    // ── Enqueue Cloudinary upload (non-blocking after response sent) ────────
    await chatMediaQueue.add(
      "upload",
      {
        filePath: req.file.path,  // absolute disk path
        chatId: chatId.toString(),
        messageId: newMessage._id.toString(),
        senderId: userId.toString(),
        mediaType: fileType,
        originalName: req.file.originalname,
      },
      { priority: 1 }
    );

  } catch (error) {
    console.error("Upload media error:", error);
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// Get count of unique chats with unread messages
export const getUnreadChatsCount = async (req, res) => {
  try {
    const rawUserId = req.user._id || req.user.id;
    const userId = new mongoose.Types.ObjectId(rawUserId);
    
    // Highly Scalable Aggregation Pipeline (supports millions of users):
    // 1. Match ONLY the chats where the current user is a participant OR it's a support chat (if admin).
    // 2. Perform a lookup on the 'messages' collection for each chat.
    // 3. Find messages NOT sent by the user, and NOT read by the user.
    // 4. Use $limit: 1 to stop searching as soon as ONE unread message is found (O(1) early exit).
    // 5. Count how many chats have at least one such unread message.
    
    const currentUser = await User.findById(userId);
    let matchQuery = { participants: userId };
    if (currentUser && currentUser.role === 'admin') {
      matchQuery = { $or: [{ participants: userId }, { isSupportChat: true }] };
    }

    const unreadCountAggregate = await Chat.aggregate([
      { $match: matchQuery },
      { 
        $lookup: {
          from: "messages",
          let: { chatId: "$_id" },
          pipeline: [
            { 
              $match: {
                $expr: { $eq: ["$chatId", "$$chatId"] },
                sender: { $ne: userId },
                readBy: { $ne: userId }
              }
            },
            { $limit: 1 } // Early exit ensures massive performance gains
          ],
          as: "unreadMessages"
        }
      },
      { $match: { "unreadMessages.0": { $exists: true } } },
      { $count: "unreadChats" }
    ]);

    const count = unreadCountAggregate.length > 0 ? unreadCountAggregate[0].unreadChats : 0;

    res.json({ success: true, count });
  } catch (error) {
    console.error("Unread chat count error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete message for current user only
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id || req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (!message.deletedFor) {
      message.deletedFor = [];
    }

    if (!message.deletedFor.some(id => id.toString() === userId.toString())) {
      message.deletedFor.push(userId);
      await message.save();
    }

    res.json({ success: true, message: "Message deleted for you" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
