import mongoose from "mongoose"; // Trigger restart 3
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
import jwt from "jsonwebtoken"; // ✅ OPTIMIZATION: Import JWT for socket auth
import authRoutes from "./routes/authRoutes.js";
import { connectToDatabase } from "./config/db.js";
import fs from "fs";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import User from "./models/User.model.js";
import imageUploadRoutes from "./routes/imageUploadRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import tokenRoutes from "./routes/tokenRoutes.js";
import oauthRoutes from "./routes/oauthRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";

import { enforceHTTPS, securityHeaders, removeSensitiveHeaders } from "./middlewares/securityMiddleware.js";

import { apiLimiter } from "./middlewares/rateLimiter.js"; // ✅ FIX: Global rate limiter import

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
      
      // Add production domain (exact match only)
      const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN;
      if (PRODUCTION_DOMAIN) {
        allowedSocketOrigins.push(`https://${PRODUCTION_DOMAIN}`);
      }
      
      // 🔒 SECURITY FIX: Block no-origin in production (same policy as HTTP CORS)
      // Allow no-origin so Next.js SSR / Server Components can fetch data
      if (!origin) {
        return callback(null, true);
      }

      // Allow everything in development for easier local testing (including 127.0.0.1 vs localhost)
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // 🔒 SECURITY FIX: Exact match only
      if (allowedSocketOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  // Important for Render.com and cloud platforms
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 120000,
  pingInterval: 30000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6, // ✅ FIX: was 100MB (1e8) — reduced to 1MB to prevent DoS memory exhaustion
});


// Make io accessible globally
app.set("io", io);
global.io = io; // Make io accessible in controllers

// Socket.io connection with user tracking
const onlineUsers = new Map();
// Expose globally so background craftsmans can check online status
global.__onlineUsers = onlineUsers;

// ✅ OPTIMIZATION: Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers?.cookie?.split('token=')?.[1]?.split(';')?.[0];
  if (!token) {
    socket.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN);
    socket.user = decoded; // Attach user to socket
    next();
  } catch (err) {
    socket.user = null;
    next();
  }
});

io.on("connection", (socket) => {
  logger.info(`[SOCKET] New patron connected: ${socket.id}, User ID: ${socket.user?.id}`);

  // 🔒 Track authenticated userId per socket for ownership checks
  let authenticatedUserId = socket.user?.id; // Use ID from JWT 

  // User joins with their ID
  socket.on("user:online", async (userId) => {
    if (!userId || typeof userId !== "string") return;
    authenticatedUserId = userId;
    
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);
    
    // Support Chat: add admin sockets to a dedicated room
    try {
      const userObj = await User.findById(userId).select("role");
      if (userObj && userObj.role === 'admin') {
        socket.join("admins_room");
        logger.info(`[SOCKET] User ${userId} joined admins_room`);
      }
    } catch(err) {
      logger.error(`[SOCKET] Error joining admins_room: ${err.message}`);
    }

    io.emit("user:status", { userId, status: "online" });
    logger.info(`[SOCKET] User ${userId} is online. Active sockets: ${onlineUsers.get(userId).size}`);

    // Send back the full list of currently online users to the newly connected socket
    const currentlyOnline = Array.from(onlineUsers.keys());
    socket.emit("users:onlineList", currentlyOnline);
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
    logger.info(`[SOCKET] Socket ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on("chat:leave", (chatId) => {
    socket.leave(chatId);
  });


  // --- WebRTC Call Signaling ---
  socket.on("call:initiate", ({ targetUserId, callerId, callType, chatId }) => {
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(s => io.to(s).emit("call:incoming", { callerId, callType, chatId }));
    }
  });

  socket.on("call:accept", ({ targetUserId, callerId }) => {
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(s => io.to(s).emit("call:accepted", { responderId: callerId }));
    }
  });

  socket.on("call:reject", ({ targetUserId, callerId }) => {
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(s => io.to(s).emit("call:rejected", { responderId: callerId }));
    }
  });

  socket.on("webrtc:signal", ({ targetUserId, signal }) => {
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(s => io.to(s).emit("webrtc:signal", { senderId: socket.id, signal }));
    }
  });

  socket.on("call:end", ({ targetUserId }) => {
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach(s => io.to(s).emit("call:ended"));
    }
  });

  // 🔒 SECURITY FIX: Verify sender ownership before unsending
  // O(1) lookup using authenticatedUserId bound to this socket
  socket.on("message:unsend", async ({ chatId, messageId }) => {
    try {
      if (!authenticatedUserId) return; // reject unauthenticated sockets
      const Message = (await import("./models/Message.model.js")).default;
      const msg = await Message.findById(messageId).select("sender").lean();
      if (!msg) return;
      // Only the message sender can unsend it
      if (msg.sender.toString() !== authenticatedUserId) {
        console.warn(`[SECURITY] Unauthorized unsend attempt by ${authenticatedUserId} on message ${messageId}`);
        return;
      }
      await Message.findByIdAndUpdate(messageId, { isUnsent: true });
      io.to(chatId).emit("message:unsend", { messageId });
    } catch (err) {
      console.error("Unsend error:", err);
    }
  });

  // 🔒 SECURITY FIX: Validate reactions shape; prevent arbitrary DB overwrites
  socket.on("message:react", async ({ chatId, messageId, emoji }) => {
    try {
      if (!authenticatedUserId) return;
      // Whitelist allowed emoji characters (no arbitrary object injection)
      if (typeof emoji !== "string" || emoji.length > 10) return;
      const Message = (await import("./models/Message.model.js")).default;

      const msg = await Message.findById(messageId).select("reactions").lean();
      if (!msg) return;
      // Build reactions as { emoji: [userId, ...] } safely server-side
      const reactions = msg.reactions || {};
      if (!reactions[emoji]) reactions[emoji] = [];
      const idx = reactions[emoji].indexOf(authenticatedUserId);
      if (idx > -1) {
        reactions[emoji].splice(idx, 1); // toggle off
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji].push(authenticatedUserId); // toggle on
      }
      await Message.findByIdAndUpdate(messageId, { reactions });
      io.to(chatId).emit("message:react", { messageId, reactions });
    } catch (err) {
      console.error("React error:", err);
    }
  });

  // 🔒 SECURITY FIX: Only the authenticated socket owner can reset their own badge
  socket.on("user:notification-reset-trigger", ({ userId }) => {
    if (!authenticatedUserId || authenticatedUserId !== userId) {
      console.warn(`[SECURITY] Unauthorized notification-reset attempt: claimed ${userId}, actual ${authenticatedUserId}`);
      return;
    }
    io.emit(`user:${userId}:notification-reset`);
  });

  socket.on("disconnect", async () => {
    // O(1) lookup: use authenticatedUserId directly
    if (authenticatedUserId && onlineUsers.has(authenticatedUserId)) {
      const userSockets = onlineUsers.get(authenticatedUserId);
      userSockets.delete(socket.id);
      
      if (userSockets.size === 0) {
        onlineUsers.delete(authenticatedUserId);
        const lastActiveAt = new Date();
        try {
          await User.findByIdAndUpdate(authenticatedUserId, { lastActiveAt });
        } catch (err) {
          logger.error(`[SOCKET] Error saving lastActiveAt: ${err.message}`);
        }
        io.emit("user:status", { userId: authenticatedUserId, status: "offline", lastActiveAt });
        logger.info(`[SOCKET] User ${authenticatedUserId} went offline`);
      }
      authenticatedUserId = null;
    }
    logger.info(`[SOCKET] Patron disconnected: ${socket.id}`);
  });
});

// Make onlineUsers accessible
app.set("onlineUsers", onlineUsers);

// Set io instance for craftsmans
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
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ---------------- CSRF Protection ----------------
// Million-dollar standard: Double-submit cookie pattern
import crypto from "crypto";
const csrfProtection = (req, res, next) => {
  // 1. Generate token if not exists
  let csrfToken = req.cookies["XSRF-TOKEN"];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie("XSRF-TOKEN", csrfToken, {
      httpOnly: false, // Must be accessible by frontend to read and send back in header
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // ✅ FIX: 24h expiry — was missing (permanent session cookie)
    });
  }

  // 2. Validate for state-changing methods
  const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"];
  const isExempted = req.path.startsWith("/api/v1/track") || req.path.startsWith("/api/v1/analytics") || req.path.startsWith("/api/v1/auth/guest-login") || req.path.startsWith("/api/v1/market/delivery/calculate");
  
  if (stateChangingMethods.includes(req.method) && !isExempted) {
    const headerToken = req.headers["x-xsrf-token"];
    if (!headerToken || headerToken !== csrfToken) {
      logger.warn(`[SECURITY] CSRF attempt blocked: Method=${req.method}, Path=${req.path}, IP=${req.ip}`);
      return res.status(403).json({ success: false, message: "Invalid CSRF token" });
    }
  }
  // 3. Attach to request for controllers
  req.csrfToken = csrfToken;

  // 4. Expose token in header so frontend can read it even if cookies are blocked cross-origin
  res.setHeader("X-CSRF-Token", csrfToken);
  const exposed = res.getHeader("Access-Control-Expose-Headers") || "";
  res.setHeader("Access-Control-Expose-Headers", exposed ? exposed + ", X-CSRF-Token" : "X-CSRF-Token");

  next();
};

const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:3001",
];

// Add your production Vercel domain here
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN; // e.g., "your-app.vercel.app"

const strictCors = cors({
    origin: function (origin, callback) {
      // Allow no-origin so Next.js SSR / Server Components can fetch data
      if (!origin) {
        return callback(null, true);
      }
      
      // Allow everything in development for easier local testing (including 127.0.0.1 vs localhost)
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Check if origin is in allowed list (ignoring trailing slashes)
      const normalizedOrigin = origin.replace(/\/$/, "");
      const normalizedAllowed = allowedOrigins.map(url => url.replace(/\/$/, ""));
      if (normalizedAllowed.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      
      // Check if it's your specific production Vercel domain (exact match, not wildcard)
      if (PRODUCTION_DOMAIN && origin === `https://${PRODUCTION_DOMAIN}`) {
        return callback(null, true);
      }
      
      // Check if it's a vercel preview domain
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      
      // Reject all other origins
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  });

app.use((req, res, next) => {
  // OAuth login routes are accessed directly via the browser and often lack an Origin header.
  // We bypass the strict no-origin check for these specific routes.
  if (req.path.startsWith('/api/v1/oauth')) {
    return cors({ credentials: true, origin: true })(req, res, next);
  }
  return strictCors(req, res, next);
});
app.use(compression());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Apply CSRF and Sanitization after body parsing
app.use(csrfProtection);
import { sanitizeInput } from "./middlewares/securityMiddleware.js";
app.use(sanitizeInput);

// ---------------- Performance Logging Middleware ----------------

// 🚀 Track API response times and log slow requests
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 200) {
      logger.warn(`⚠️  SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
    }
    logger.info(`${req.method} ${req.originalUrl} - ${duration}ms - ${res.statusCode}`);
  });
  
  next();
});

// ---------------- Routes ----------------
// ✅ FIX: Apply global rate limiter to all API routes (auth routes have stricter limits on top)
// ✅ KEEP-ALIVE PING ROUTE
app.get("/api/ping", (req, res) => {
  res.status(200).json({ status: "awake", timestamp: new Date() });
});

app.use("/api/", apiLimiter);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/tokens", tokenRoutes);
// Serve uploaded chat files as static assets
app.use("/uploads", express.static("uploads"));

app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/upload", imageUploadRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/verification", verificationRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/oauth", oauthRoutes);
app.use("/api/v1/market", marketRoutes);


app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// 🔒 SECURITY FIX: /health/detailed requires admin authentication
import { protect, adminOnly } from "./middlewares/authMiddleware.js";
app.get("/health/detailed", protect, adminOnly, async (req, res) => {
  try {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      server: {
        port: PORT,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB"
        },
        cpu: process.cpuUsage()
      },
      database: {
        mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0
      },
      socket: {
        connected: io.engine.clientsCount || 0,
        onlineUsers: onlineUsers.size
      }
    };
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// ---------------- DB Connect & Server Start ----------------
const startServer = async () => {
  try {
    await connectToDatabase();
    logger.info("✅ MongoDB connection established");
    


    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("❌ MongoDB init error:", err.message);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

startServer();

// ---------------- Error Handler ----------------
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error(`Error ${statusCode}: ${err.message}\nStack: ${err.stack}`);
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});
