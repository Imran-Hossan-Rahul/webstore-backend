import multer from "multer";
import path from "path";

// Upload storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // uploads folder project root এ থাকতে হবে
  },
  filename: function (req, file, cb) {
    // filename: timestamp + original name
    const ext = path.extname(file.originalname);
    const name = file.fieldname + "-" + Date.now() + ext;
    cb(null, name);
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
