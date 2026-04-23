import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

/**
 * File Validator Utility
 * Validates uploaded files before processing
 */

// Allowed file extensions
const ALLOWED_PREVIEW_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm'];
const ALLOWED_PROJECT_EXTENSIONS = ['.zip', '.json', '.html', '.js', '.css'];

// Max file sizes (in bytes)
const MAX_PREVIEW_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PROJECT_SIZE = 50 * 1024 * 1024; // 50MB

// Dangerous file patterns in zip
const DANGEROUS_PATTERNS = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.sh$/i,
    /\.dll$/i,
    /\.so$/i,
    /\.dylib$/i,
    /\.app$/i,
    /\.scr$/i,
    /\.vbs$/i,
    /\.jar$/i,
    /\.class$/i,
    /\.php$/i,
    /\.asp$/i,
    /\.aspx$/i,
];

/**
 * Validate preview file (image/video)
 */
export function validatePreviewFile(file) {
    const errors = [];
    
    if (!file) {
        errors.push('Preview file is required');
        return { valid: false, errors };
    }

    // Check file size
    if (file.size > MAX_PREVIEW_SIZE) {
        errors.push(`Preview file too large. Max size: ${MAX_PREVIEW_SIZE / (1024 * 1024)}MB`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PREVIEW_EXTENSIONS.includes(ext)) {
        errors.push(`Invalid preview file type. Allowed: ${ALLOWED_PREVIEW_EXTENSIONS.join(', ')}`);
    }

    // Check mimetype
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
        errors.push('Preview must be an image or video file');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate project file (zip/code files)
 */
export function validateProjectFile(file) {
    const errors = [];
    
    if (!file) {
        errors.push('Project file is required');
        return { valid: false, errors };
    }

    // Check file size
    if (file.size > MAX_PROJECT_SIZE) {
        errors.push(`Project file too large. Max size: ${MAX_PROJECT_SIZE / (1024 * 1024)}MB`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PROJECT_EXTENSIONS.includes(ext)) {
        errors.push(`Invalid project file type. Allowed: ${ALLOWED_PROJECT_EXTENSIONS.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Scan ZIP file for dangerous content
 */
export function scanZipFile(filePath) {
    const errors = [];
    const warnings = [];

    try {
        if (!fs.existsSync(filePath)) {
            errors.push('File not found');
            return { valid: false, errors, warnings };
        }

        // Check if it's a zip file
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.zip') {
            // Not a zip, skip scanning
            return { valid: true, errors: [], warnings: [] };
        }

        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        if (zipEntries.length === 0) {
            errors.push('ZIP file is empty');
            return { valid: false, errors, warnings };
        }

        // Check for dangerous files
        for (const entry of zipEntries) {
            const entryName = entry.entryName.toLowerCase();

            // Check for dangerous patterns
            for (const pattern of DANGEROUS_PATTERNS) {
                if (pattern.test(entryName)) {
                    errors.push(`Dangerous file detected: ${entry.entryName}`);
                }
            }

            // Check for hidden files (warning only)
            if (entryName.includes('/.') || entryName.startsWith('.')) {
                warnings.push(`Hidden file detected: ${entry.entryName}`);
            }

            // Check for very large files inside zip
            if (entry.header.size > 20 * 1024 * 1024) { // 20MB per file
                warnings.push(`Large file in ZIP: ${entry.entryName} (${(entry.header.size / (1024 * 1024)).toFixed(2)}MB)`);
            }
        }

        // Check total uncompressed size
        const totalSize = zipEntries.reduce((sum, entry) => sum + entry.header.size, 0);
        if (totalSize > 100 * 1024 * 1024) { // 100MB uncompressed
            errors.push(`ZIP content too large when uncompressed: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);
        }

    } catch (error) {
        errors.push(`Failed to scan ZIP: ${error.message}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate all uploaded files
 */
export function validateUploadedFiles(files) {
    const allErrors = [];
    const allWarnings = [];

    // Validate preview file
    if (files.previewFile && files.previewFile[0]) {
        const previewValidation = validatePreviewFile(files.previewFile[0]);
        if (!previewValidation.valid) {
            allErrors.push(...previewValidation.errors);
        }
    } else {
        allErrors.push('Preview file is required');
    }

    // Validate project file
    if (files.projectFile && files.projectFile[0]) {
        const projectValidation = validateProjectFile(files.projectFile[0]);
        if (!projectValidation.valid) {
            allErrors.push(...projectValidation.errors);
        }

        // Scan ZIP if it's a zip file
        const projectFile = files.projectFile[0];
        if (projectFile.path && path.extname(projectFile.originalname).toLowerCase() === '.zip') {
            const scanResult = scanZipFile(projectFile.path);
            if (!scanResult.valid) {
                allErrors.push(...scanResult.errors);
            }
            allWarnings.push(...scanResult.warnings);
        }
    } else {
        allErrors.push('Project file is required');
    }

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
    };
}
