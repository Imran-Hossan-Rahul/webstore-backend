import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/submissions");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitizedOriginalName = path.basename(file.originalname);
    const ext = path.extname(sanitizedOriginalName);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = `submission-${uniqueSuffix}${ext}`;
    
    const finalPath = path.join(uploadDir, safeName);
    if (!finalPath.startsWith(uploadDir)) {
      return cb(new Error("Invalid file path detected"));
    }
    
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    "application/zip", "application/x-zip-compressed", "application/pdf"
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Images, Videos, PDFs, and ZIPs only."), false);
  }
};

export const submissionUpload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: fileFilter,
});

