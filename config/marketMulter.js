import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/market/");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename to prevent path traversal
    const sanitizedOriginalName = path.basename(file.originalname);
    const ext = path.extname(sanitizedOriginalName);
    const safeName = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    
    // Verify the final path is within uploadDir
    const finalPath = path.join(uploadDir, safeName);
    if (!finalPath.startsWith(uploadDir)) {
      return cb(new Error('Invalid file path detected'));
    }
    
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedVideos = ["video/mp4", "video/webm", "video/ogg"];

  const allAllowed = [...allowedImages, ...allowedVideos];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not supported. Please upload valid image or video formats."));
  }
};

const marketMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export default marketMediaUpload;
