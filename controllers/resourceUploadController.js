import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { devlogResourceQueue } from "../queues/devlogResourceQueue.js";

// Configure multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = "uploads/temp_resources";
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Keep original extension but randomize name to prevent collision
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `resource-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/zip', 
    'application/x-zip-compressed', 
    'application/pdf',
    'application/x-7z-compressed',
    'application/vnd.rar'
  ];
  // Basic extension check as fallback
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.zip', '.pdf', '.rar', '.7z'];
  
  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only ZIP, PDF, RAR, 7Z are allowed."), false);
  }
};

export const uploadResource = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter,
});

/**
 * Handle Resource Upload (Temp)
 * @route POST /api/v1/upload/resource
 */
export const uploadDevlogResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Return the temp path so the frontend can send it when creating the post
    res.status(200).json({
      success: true,
      data: {
        tempPath: req.file.path,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error("Resource Upload Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

