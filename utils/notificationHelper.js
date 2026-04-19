import { createNotification } from "../controllers/notificationController.js";

export const notifyNewMessage = async (io, recipientId, senderId, senderName, chatId) => {
  await createNotification(recipientId, {
    sender: senderId,
    type: "message",
    title: "New Message",
    message: `${senderName} sent you a message`,
    link: `/inbox?chat=${chatId}`
  });
  io.emit(`user:${recipientId}:notification`, { type: "message" });
};

export const notifyNewFollower = async (io, recipientId, followerId, followerName) => {
  await createNotification(recipientId, {
    sender: followerId,
    type: "follow",
    title: "New Follower",
    message: `${followerName} started following you`,
    link: `/user/${followerId}`
  });
  io.emit(`user:${recipientId}:notification`, { type: "follow" });
};

export const notifyNewLike = async (io, recipientId, likerId, likerName, postId) => {
  await createNotification(recipientId, {
    sender: likerId,
    type: "like",
    title: "New Like",
    message: `${likerName} liked your post`,
    link: `/templates/${postId}`
  });
  io.emit(`user:${recipientId}:notification`, { type: "like" });
};

export const notifyNewComment = async (io, recipientId, commenterId, commenterName, postId) => {
  await createNotification(recipientId, {
    sender: commenterId,
    type: "comment",
    title: "New Comment",
    message: `${commenterName} commented on your post`,
    link: `/templates/${postId}`
  });
  io.emit(`user:${recipientId}:notification`, { type: "comment" });
};

export const notifyNewPurchase = async (io, recipientId, buyerId, buyerName, templateTitle) => {
  await createNotification(recipientId, {
    sender: buyerId,
    type: "purchase",
    title: "New Purchase",
    message: `${buyerName} purchased your template "${templateTitle}"`,
    link: `/dashboard`
  });
  io.emit(`user:${recipientId}:notification`, { type: "purchase" });
};
