import Notification from "../models/Notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { filter = "all", limit = 20 } = req.query;

    const query = { recipient: userId };
    if (filter === "unread") query.read = false;

    const notifications = await Notification.find(query)
      .populate("sender", "username name profilePicture")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const count = await Notification.countDocuments({ recipient: userId, read: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ recipient: userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createNotification = async (recipientId, data) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      ...data
    });
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};
