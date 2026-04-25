import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Upload storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename to prevent path traversal
    const sanitizedOriginalName = path.basename(file.originalname);
    const ext = path.extname(sanitizedOriginalName);
    const nameWithoutExt = path.basename(sanitizedOriginalName, ext);
    // Remove any non-alphanumeric characters except dash and underscore
    const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalName = file.fieldname + "-" + Date.now() + "-" + safeName + ext;
    
    // Verify the final path is within uploadDir
    const finalPath = path.join(uploadDir, finalName);
    if (!finalPath.startsWith(uploadDir)) {
      return cb(new Error('Invalid file path detected'));
    }
    
    cb(null, finalName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // previewFile → image/video
  if (file.fieldname === "previewFile") {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Preview must be image or video"));
    }
  }
  // projectFile → zip/json/html/js/css
  else if (file.fieldname === "projectFile") {
    const allowed = [
      "application/zip",
      "application/x-zip-compressed",
      "application/json",
      "text/javascript",
      "application/javascript",
      "text/css",
      "text/html",
      "application/octet-stream",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(zip|json|html|js|css)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Project file must be zip/json/html/js/css"));
    }
  } else {
    cb(null, false);
  }
};

// Max file size
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for projectFile
});

export default upload;
