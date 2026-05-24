import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/challenges";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `challenge-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg", "image/png", "image/webp", "image/jpg",
    "application/pdf", "application/zip", "application/x-zip-compressed",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ];
  if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(zip|pdf|doc|docx|txt)$/i)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Allowed: Images, PDF, ZIP, DOC, TXT."), false);
  }
};

export const challengeUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
