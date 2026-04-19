import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/quick-posts/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImages = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"];
  const allowedVideos = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
  
  const allAllowed = [...allowedImages, ...allowedVideos];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed"));
  }
};

const quickPostUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export default quickPostUpload;
