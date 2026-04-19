import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/chat/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedVideos = ["video/mp4", "video/webm", "video/ogg"];
  const allowedFiles = [
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ];

  const allAllowed = [...allowedImages, ...allowedVideos, ...allowedFiles];

  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not supported"));
  }
};

const chatMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

export default chatMediaUpload;
