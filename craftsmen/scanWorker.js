import { Worker as Craftsman } from "bullmq";
import IORedis from 'ioredis';
import Artifact from '../models/Artifact.model.js';
import { scanZipFile } from '../utils/fileValidator.js';
import cloudinary from '../services/cloudinary.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

/**
 * Scan Craftsman - Background file scanning
 * Handles deep scanning of uploaded files without blocking upload
 */
const scanCraftsman = new Craftsman(
  'scan-queue',
  async (job) => {
    const { artifactId, devlogFilePath, devlogFileUrl } = job.data;

    try {
      logger.info(`[SCAN CRAFTSMAN] Starting scan for artifact ${artifactId}`);

      let scanResult = { valid: true, errors: [], warnings: [] };
      let needsDownload = false;

      // If file is already on Cloudinary, download it temporarily
      if (devlogFileUrl && !devlogFilePath) {
        needsDownload = true;
        const tempPath = path.join('uploads/temp/scan', `${artifactId}_${Date.now()}.zip`);
        
        // Ensure directory exists
        const dir = path.dirname(tempPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Download file
        const response = await axios({
          method: 'GET',
          url: devlogFileUrl,
          responseType: 'stream',
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Scan downloaded file
        scanResult = scanZipFile(tempPath);

        // Clean up
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } else if (devlogFilePath && fs.existsSync(devlogFilePath)) {
        // Scan local file
        scanResult = scanZipFile(devlogFilePath);
      }

      // Update artifact based on scan result
      const artifact = await Artifact.findById(artifactId);
      if (!artifact) {
        logger.error(`[SCAN CRAFTSMAN] Artifact ${artifactId} not found`);
        return;
      }

      if (!scanResult.valid) {
        // Mark as flagged/rejected
        artifact.status = 'flagged';
        artifact.scanResult = {
          scanned: true,
          passed: false,
          errors: scanResult.errors,
          warnings: scanResult.warnings,
          scannedAt: new Date(),
        };

        await artifact.save();
        await artifact.addAuditLog(
          `Security scan failed: ${scanResult.errors.join(', ')}`,
          'system',
          'scan-craftsman'
        );

        logger.warn(`[SCAN CRAFTSMAN] Artifact ${artifactId} flagged:`, scanResult.errors);

        // Optional: Delete from Cloudinary if dangerous
        if (devlogFileUrl && scanResult.errors.some(e => e.includes('Dangerous'))) {
          try {
            const publicId = devlogFileUrl.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            logger.info(`[SCAN CRAFTSMAN] Deleted dangerous file from Cloudinary: ${publicId}`);
          } catch (err) {
            logger.error('[SCAN CRAFTSMAN] Failed to delete from Cloudinary:', err);
          }
        }
      } else {
        // Mark as approved
        artifact.status = 'approved';
        artifact.scanResult = {
          scanned: true,
          passed: true,
          errors: [],
          warnings: scanResult.warnings,
          scannedAt: new Date(),
        };

        await artifact.save();
        logger.info(`[SCAN CRAFTSMAN] Artifact ${artifactId} approved`);
      }

      return { success: true, artifactId, scanResult };
    } catch (error) {
      logger.error(`[SCAN CRAFTSMAN] Error scanning artifact ${artifactId}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 scans simultaneously
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second
    },
  }
);

scanCraftsman.on('completed', (job) => {
  logger.info(`[SCAN CRAFTSMAN] Job ${job.id} completed for artifact ${job.data.artifactId}`);
});

scanCraftsman.on('failed', (job, err) => {
  logger.error(`[SCAN CRAFTSMAN] Job ${job.id} failed:`, err.message);
});

scanCraftsman.on('error', (err) => {
  logger.error('[SCAN CRAFTSMAN] Craftsman error:', err);
});

export default scanCraftsman;


