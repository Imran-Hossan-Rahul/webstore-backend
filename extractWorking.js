import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import AdmZip from "adm-zip";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

const app = express();
const PORT = 5000;

// ---------------- Middleware ----------------
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ---------------- Upload Directories ----------------
const uploadsDir = path.join(process.cwd(), "uploads");
const extractedDir = path.join(process.cwd(), "extracted");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir);

// ---------------- Multer Setup ----------------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/zip",
      "application/x-zip-compressed",
      "multipart/x-zip",
      "application/octet-stream",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only zip files are allowed"), false);
    }
    cb(null, true);
  },
});

// ---------------- Helper Function ----------------
function findIndexHtml(dir) {
  const files = fs.readdirSync(dir);
  for (let file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    if (stats.isFile() && file.toLowerCase() === "index.html") {
      return fullPath;
    } else if (stats.isDirectory()) {
      const found = findIndexHtml(fullPath);
      if (found) return found;
    }
  }
  return null;
}

// ---------------- Routes ----------------
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Upload endpoint
app.post("/api/v1/artifact/upload", upload.single("artifact"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const zipPath = req.file.path;
  const extractFolder = path.join(
    extractedDir,
    path.parse(req.file.filename).name
  );

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractFolder, true);

    // Recursive search for index.html
    const indexPath = findIndexHtml(extractFolder);
    if (!indexPath) {
      return res.status(400).json({ message: "index.html not found in zip" });
    }

    res.json({
      message: "Artifact uploaded and extracted successfully",
      extractedFolder: extractFolder,
      indexFile: indexPath,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to extract zip", error: err.message });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

