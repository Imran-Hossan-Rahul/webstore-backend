import express from 'express';
import * as licenseController from '../controllers/licenseController.js';

const router = express.Router();

router.post('/activate', licenseController.activateLicense);
router.post('/verify', licenseController.verifyLicense);
router.post('/deactivate', licenseController.deactivateLicense);

export default router;
