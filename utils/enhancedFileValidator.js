import fs from "fs";
import path from "path";

/**
 * Magic bytes (file signatures) for common file types
 */
const FILE_SIGNATURES = {
  // Images
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
  
  // Videos
  mp4: [0x00, 0x00, 0x00],
  webm: [0x1a, 0x45, 0xdf, 0xa3],
  
  // Documents
  pdf: [0x25, 0x50, 0x44, 0x46],
  zip: [0x50, 0x4b, 0x03, 0x04],
  
  // Text files (no magic bytes, check by content)
  json: null,
  html: null,
  css: null,
  js: null,
  txt: null,
};

/**
 * Check if file matches expected magic bytes
 */
function checkMagicBytes(buffer, expectedSignature) {
  if (!expectedSignature) return true; // Skip for text files
  
  for (let i = 0; i < expectedSignature.length; i++) {
    if (buffer[i] !== expectedSignature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Validate file by checking magic bytes
 */
export function validateFileType(filePath, expectedExtension) {
  try {
    const ext = expectedExtension.toLowerCase().replace(".", "");
    const signature = FILE_SIGNATURES[ext];
    
    // For text files, skip magic byte check
    if (signature === null) {
      return true;
    }
    
    // Read first few bytes
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    
    return checkMagicBytes(buffer, signature);
  } catch (error) {
    console.error("File validation error:", error);
    return false;
  }
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize, maxSizeMB = 50) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename) {
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);
  
  // Remove any dangerous characters
  const safeName = nameWithoutExt
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 100); // Limit length
  
  return safeName + ext.toLowerCase();
}

/**
 * Check if file extension is allowed
 */
export function isAllowedExtension(filename, allowedExtensions) {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Comprehensive file validation
 */
export async function validateUploadedFile(file, options = {}) {
  const {
    maxSizeMB = 50,
    allowedExtensions = [],
    checkMagicBytes = true,
  } = options;
  
  const errors = [];
  
  // Check file size
  if (!validateFileSize(file.size, maxSizeMB)) {
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }
  
  // Check extension
  if (allowedExtensions.length > 0) {
    if (!isAllowedExtension(file.originalname, allowedExtensions)) {
      errors.push(`File type not allowed. Allowed: ${allowedExtensions.join(", ")}`);
    }
  }
  
  // Check magic bytes if file exists on disk
  if (checkMagicBytes && file.path) {
    const ext = path.extname(file.originalname);
    if (!validateFileType(file.path, ext)) {
      errors.push("File content does not match file extension");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
