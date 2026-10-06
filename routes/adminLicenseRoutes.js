import express from 'express';
import * as adminLicenseController from '../controllers/adminLicenseController.js';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/all', adminLicenseController.getAllLicenses);
router.put('/:id/status', adminLicenseController.updateLicenseStatus);
router.post('/identify-leak', adminLicenseController.identifyLeak);
router.get('/abuse-flags', adminLicenseController.getAbuseFlags);

export default router;
