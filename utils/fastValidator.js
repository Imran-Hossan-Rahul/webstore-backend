import path from 'path';

/**
 * Fast File Validator
 * Only performs instant checks without deep scanning
 * Deep scanning happens in background craftsman
 */

// Allowed file extensions
const ALLOWED_PREVIEW_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm'];
const ALLOWED_DEVLOG_EXTENSIONS = ['.zip', '.json', '.html', '.js', '.css'];

// Max file sizes (in bytes)
const MAX_PREVIEW_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DEVLOG_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Fast validation - Only checks size, extension, mimetype
 * NO deep scanning (that happens in craftsman)
 */
export function fastValidatePreviewFile(file) {
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
 * Fast validation for devlog file
 */
export function fastValidateDevlogFile(file) {
    const errors = [];
    
    if (!file) {
        errors.push('Devlog file is required');
        return { valid: false, errors };
    }

    // Check file size
    if (file.size > MAX_DEVLOG_SIZE) {
        errors.push(`Devlog file too large. Max size: ${MAX_DEVLOG_SIZE / (1024 * 1024)}MB`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DEVLOG_EXTENSIONS.includes(ext)) {
        errors.push(`Invalid devlog file type. Allowed: ${ALLOWED_DEVLOG_EXTENSIONS.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Fast validation for all files
 * Returns immediately without deep scanning
 */
export function fastValidateUploadedFiles(files) {
    const allErrors = [];

    // Validate preview file
    if (files.previewFile && files.previewFile[0]) {
        const previewValidation = fastValidatePreviewFile(files.previewFile[0]);
        if (!previewValidation.valid) {
            allErrors.push(...previewValidation.errors);
        }
    } else {
        allErrors.push('Preview file is required');
    }

    // Validate devlog file
    if (files.devlogFile && files.devlogFile[0]) {
        const devlogValidation = fastValidateDevlogFile(files.devlogFile[0]);
        if (!devlogValidation.valid) {
            allErrors.push(...devlogValidation.errors);
        }
    } else {
        allErrors.push('Devlog file is required');
    }

    return {
        valid: allErrors.length === 0,
        errors: allErrors
    };
}

