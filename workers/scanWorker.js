import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import ButtonTemplate from '../models/Template.model.js';
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
 * Scan Worker - Background file scanning
 * Handles deep scanning of uploaded files without blocking upload
 */
const scanWorker = new Worker(
  'scan-queue',
  async (job) => {
    const { templateId, projectFilePath, projectFileUrl } = job.data;

    try {
      logger.info(`[SCAN WORKER] Starting scan for template ${templateId}`);

      let scanResult = { valid: true, errors: [], warnings: [] };
      let needsDownload = false;

      // If file is already on Cloudinary, download it temporarily
      if (projectFileUrl && !projectFilePath) {
        needsDownload = true;
        const tempPath = path.join('uploads/temp/scan', `${templateId}_${Date.now()}.zip`);
        
        // Ensure directory exists
        const dir = path.dirname(tempPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Download file
        const response = await axios({
          method: 'GET',
          url: projectFileUrl,
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
      } else if (projectFilePath && fs.existsSync(projectFilePath)) {
        // Scan local file
        scanResult = scanZipFile(projectFilePath);
      }

      // Update template based on scan result
      const template = await ButtonTemplate.findById(templateId);
      if (!template) {
        logger.error(`[SCAN WORKER] Template ${templateId} not found`);
        return;
      }

      if (!scanResult.valid) {
        // Mark as flagged/rejected
        template.status = 'flagged';
        template.scanResult = {
          scanned: true,
          passed: false,
          errors: scanResult.errors,
          warnings: scanResult.warnings,
          scannedAt: new Date(),
        };

        await template.save();
        await template.addAuditLog(
          `Security scan failed: ${scanResult.errors.join(', ')}`,
          'system',
          'scan-worker'
        );

        logger.warn(`[SCAN WORKER] Template ${templateId} flagged:`, scanResult.errors);

        // Optional: Delete from Cloudinary if dangerous
        if (projectFileUrl && scanResult.errors.some(e => e.includes('Dangerous'))) {
          try {
            const publicId = projectFileUrl.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            logger.info(`[SCAN WORKER] Deleted dangerous file from Cloudinary: ${publicId}`);
          } catch (err) {
            logger.error('[SCAN WORKER] Failed to delete from Cloudinary:', err);
          }
        }
      } else {
        // Mark as approved
        template.status = 'approved';
        template.scanResult = {
          scanned: true,
          passed: true,
          errors: [],
          warnings: scanResult.warnings,
          scannedAt: new Date(),
        };

        await template.save();
        logger.info(`[SCAN WORKER] Template ${templateId} approved`);
      }

      return { success: true, templateId, scanResult };
    } catch (error) {
      logger.error(`[SCAN WORKER] Error scanning template ${templateId}:`, error);
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

scanWorker.on('completed', (job) => {
  logger.info(`[SCAN WORKER] Job ${job.id} completed for template ${job.data.templateId}`);
});

scanWorker.on('failed', (job, err) => {
  logger.error(`[SCAN WORKER] Job ${job.id} failed:`, err.message);
});

scanWorker.on('error', (err) => {
  logger.error('[SCAN WORKER] Worker error:', err);
});

export default scanWorker;
