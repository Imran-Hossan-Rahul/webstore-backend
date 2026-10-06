import crypto from 'crypto';
import { ZipArchive } from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import BuildFingerprint from '../models/BuildFingerprint.model.js';

/**
 * Generates a canary token and stores it in the DB.
 */
export const createBuildFingerprint = async (licenseId) => {
  const canaryToken = crypto.randomUUID();
  const watermarkSeed = crypto.randomBytes(16).toString('hex');
  
  const fingerprint = await BuildFingerprint.create({
    license_id: licenseId,
    canary_token: canaryToken,
    watermark_seed: watermarkSeed,
    build_status: 'completed'
  });

  return fingerprint;
};

/**
 * Streams a watermarked ZIP of the source directory to the provided response stream.
 * @param {Object} res - Express response object
 * @param {String} sourceDir - Path to the product's unzipped source code on the server
 * @param {Object} fingerprint - The BuildFingerprint object containing the canary token
 */
export const streamWatermarkedZip = (res, sourceDir, fingerprint) => {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({
      zlib: { level: 9 } // Sets the compression level.
    });

    // Handle archive warnings/errors
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', function(err) {
      reject(err);
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // 1. Write the Canary Token to a config file dynamically inside the source directory
    const canaryContent = `// DO NOT REMOVE THIS FILE\n// CODALINA-DRM-FINGERPRINT: ${fingerprint.canary_token}\nconst WATERMARK = "${fingerprint.watermark_seed}";\n`;
    
    if (fs.existsSync(sourceDir)) {
      // Find actual project root (handle single wrapper folder cases like 'ai_saas/src/...')
      let projectRoot = sourceDir;
      const items = fs.readdirSync(sourceDir);
      if (items.length === 1 && fs.statSync(path.join(sourceDir, items[0])).isDirectory()) {
        projectRoot = path.join(sourceDir, items[0]);
      }
      
      // Inject into src/config/drm.config.js
      const targetConfigDir = path.join(projectRoot, 'src', 'config');
      fs.ensureDirSync(targetConfigDir); // Create src/config if it doesn't exist
      fs.writeFileSync(path.join(targetConfigDir, 'drm.config.js'), canaryContent);
      
      // 2. Zip the entire source directory (including the wrapper if it exists)
      archive.directory(sourceDir, false);
    } else {
      // Fallback if sourceDir missing
      archive.append('Dummy content for product because source dir is missing', { name: 'README.md' });
      archive.append(canaryContent, { name: 'src/config/drm.config.js' });
    }

    // Finalize the archive (this will end the stream)
    archive.finalize().then(() => resolve());
  });
};

