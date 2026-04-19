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
import { connectToDatabase } from "./config/db.js";
import fs from "fs";
import projectRoutes from "./routes/projectRoutes.js"



const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: CLIENT_URL || "*", methods: ["GET", "POST"] },
});

// Make io accessible globally
app.set("io", io);

// Socket.io connection
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ---------------- Middleware ----------------
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true },
    crossOriginEmbedderPolicy: false,
  })
);

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("uploads/thumbnails")) fs.mkdirSync("uploads/thumbnails");
if (!fs.existsSync("uploads/zips")) fs.mkdirSync("uploads/zips");
if (!fs.existsSync("uploads/projects")) fs.mkdirSync("uploads/projects");


app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ---------------- Routes ----------------
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/template", templateRoute);
app.use("/api/v1/stats", statsRoutes);
app.use("/api/v1/track", trackRoutes);
app.use("/api/v1/projects", projectRoutes);

// Serve framework extracted folders
app.use(
  "/framework-preview",
  express.static(path.join(process.cwd(), "uploads/framework"))
);

// Serve thumbnails & zips
app.use(
  "/uploads/thumbnails",
  express.static(path.join(process.cwd(), "uploads/thumbnails"))
);
app.use(
  "/uploads/zips",
  express.static(path.join(process.cwd(), "uploads/zips"))
);

// serve framework project folders dynamically
app.use(
  "/framework-preview",
  express.static(path.join(__dirname, "uploads/framework"))
);




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
