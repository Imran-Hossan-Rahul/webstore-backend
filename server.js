import mongoose from "mongoose";
import { MONGODB_CONNECTION_STRING, PORT, CLIENT_URL } from "./config/index.js";
import logger from "./utils/logger.js";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import authRoutes from "./routes/authRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import templateRoute from "./routes/buttonTemplates.js";
import statsRoutes from "./routes/analytics.js";
import trackRoutes from "./routes/trackRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import { connectToDatabase } from "./config/db.js";
import fs from "fs";
import userRoutes from "./routes/userRoutes.js";
import blogRoute from "./routes/blogRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import creatorRoutes from "./routes/creatorRoutes.js";
import publicAnalyticsRoutes from "./routes/publicAnalyticsRoutes.js";
import imageUploadRoutes from "./routes/imageUploadRoutes.js";
import projectResourceRoutes from "./routes/projectResourceRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import challengeRoutes from "./routes/challengeRoutes.js"; // Import Challenges
import communityRoutes from "./routes/communityRoutes.js";
import { enforceHTTPS, securityHeaders, removeSensitiveHeaders } from "./middlewares/securityMiddleware.js";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedSocketOrigins = [
        CLIENT_URL, 
        "http://localhost:3000", 
        "http://localhost:3001"
      ];
      
      // Add production domain
      const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN;
      if (PRODUCTION_DOMAIN) {
        allowedSocketOrigins.push(`https://${PRODUCTION_DOMAIN}`);
      }
      
      if (!origin || allowedSocketOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io accessible globally
app.set("io", io);

// Socket.io connection with user tracking
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // User joins with their ID
  socket.on("user:online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("user:status", { userId, status: "online" });
    console.log(`User ${userId} is online`);
  });

  // Typing indicator
  socket.on("typing:start", ({ chatId, userId }) => {
    socket.to(chatId).emit("user:typing", { userId, typing: true });
  });

  socket.on("typing:stop", ({ chatId, userId }) => {
    socket.to(chatId).emit("user:typing", { userId, typing: false });
  });

  // Join chat room
  socket.on("chat:join", (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on("chat:leave", (chatId) => {
    socket.leave(chatId);
  });

  // Join discussion room
  socket.on("discussion:join", (discussionId) => {
    socket.join(`discussion_${discussionId}`);
    console.log(`Socket ${socket.id} joined discussion ${discussionId}`);
  });

  // Leave discussion room
  socket.on("discussion:leave", (discussionId) => {
    socket.leave(`discussion_${discussionId}`);
  });

  socket.on("disconnect", () => {
    // Find and remove user from online list
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit("user:status", { userId, status: "offline" });
        console.log(`User ${userId} went offline`);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

// Make onlineUsers accessible
app.set("onlineUsers", onlineUsers);

// Set io instance for workers
import { setIO } from "./utils/socketManager.js";
setIO(io);

// ---------------- Middleware ----------------
// Security middlewares (must be first)
app.use(removeSensitiveHeaders);
app.use(enforceHTTPS);
app.use(securityHeaders);

app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true },
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:3001",
];

// Add your production Vercel domain here
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN; // e.g., "your-app.vercel.app"

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check if it's your production Vercel domain
      if (PRODUCTION_DOMAIN && origin === `https://${PRODUCTION_DOMAIN}`) {
        return callback(null, true);
      }
      
      // Reject all other origins
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(compression());

// Stripe webhook must be before body parser (needs raw body)
app.use("/api/v1/payment/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ---------------- Routes ----------------
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/template", templateRoute);
app.use("/api/v1/blog", blogRoute);
app.use("/api/v1/stats", statsRoutes);
app.use("/api/v1/stats/public", publicAnalyticsRoutes);
app.use("/api/v1/track", trackRoutes);
app.use("/api/v1/user", userRoutes);
// app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/payout", payoutRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/creator", creatorRoutes);
app.use("/api/v1/upload", imageUploadRoutes);
app.use("/api/v1/upload", projectResourceRoutes); // Helper for /api/v1/upload/resource
app.use("/api/v1/feed", feedRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/favorites", favoriteRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/jobs", jobRoutes);
app.use("/api/v1/challenges", challengeRoutes); // Register Challenges
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/comments", commentRoutes);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// ---------------- DB Connect ----------------
connectToDatabase()
  .then(() => logger.info("✅ MongoDB connection established"))
  .catch((err) => logger.error("❌ MongoDB init error:", err.message));

// ---------------- Error Handler ----------------
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    ip: req.ip,
  });
  res
    .status(err.statusCode || 500)
    .json({ success: false, message: err.message });
});

// ---------------- Server Start ----------------
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
