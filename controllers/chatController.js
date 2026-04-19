import mongoose from "mongoose";
import Chat from "../models/Chat.model.js";
import User from "../models/User.model.js";
import { createNotification } from "./notificationController.js";

// Get all users for chat list
export const getUsers = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const users = await User.find({ _id: { $ne: userId } })
      .select("username name email profilePicture role createdAt")
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
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
    }).populate("participants", "username name email profilePicture role");

    if (!chat) {
      chat = await Chat.create({
        participants: [currentUserId, userId],
        messages: []
      });
      chat = await chat.populate("participants", "username name email profilePicture role");
    }

    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all chats for current user
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const chats = await Chat.find({
      participants: userId
    })
      .populate("participants", "username name email profilePicture role")
      .populate("lastMessage.sender", "username name")
      .sort({ updatedAt: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get messages for a specific chat
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("messages.sender", "username name profilePicture")
      .populate("participants", "username name email profilePicture role");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Check if user is participant
    const userId = req.user._id || req.user.id;
    if (!chat.participants.some(p => p._id.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    res.json({ success: true, messages: chat.messages, chat });
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
    const isParticipant = chat.participants.some(p => p.toString() === userIdStr);
    
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "You are not a participant of this chat" });
    }

    const newMessage = {
      sender: userId,
      content,
      type,
      read: false,
      createdAt: new Date()
    };

    if (fileUrl) newMessage.fileUrl = fileUrl;
    if (fileName) newMessage.fileName = fileName;

    chat.messages.push(newMessage);
    chat.lastMessage = {
      content,
      sender: userId,
      createdAt: new Date()
    };
    chat.updatedAt = new Date();

    await chat.save();

    // Get the newly added message with populated sender
    const updatedChat = await Chat.findById(chatId)
      .populate("messages.sender", "username name profilePicture")
      .populate("participants", "username name email profilePicture role");

    const populatedMessage = updatedChat.messages[updatedChat.messages.length - 1];

    // Emit to chat room via socket
    const io = req.app.get("io");
    if (io) {
      io.to(chatId).emit("message:new", populatedMessage);
      
      // Notify other participants
      chat.participants.forEach(async (participantId) => {
        if (participantId.toString() !== userIdStr) {
          io.emit(`user:${participantId}:newMessage`, { chatId, message: populatedMessage });
          
          // Create notification
          const sender = await User.findById(userId).select("name username");
          await createNotification(participantId, {
            sender: userId,
            type: "message",
            title: "New Message",
            message: `${sender?.name || sender?.username} sent you a message`,
            link: `/inbox?chat=${chatId}`
          });
          
          io.emit(`user:${participantId}:notification`, { type: "message" });
        }
      });
    }

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

    const userIdStr = userId.toString();
    chat.messages.forEach(msg => {
      if (msg.sender && msg.sender.toString() !== userIdStr) {
        msg.read = true;
      }
    });

    await chat.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
