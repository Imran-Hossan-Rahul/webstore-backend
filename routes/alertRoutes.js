// routes/alertRoutes.js
import express from 'express';
import * as alertController from '../controllers/alertController.js';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', protect, adminOnly, alertController.createAlert);
router.get('/', protect, adminOnly, alertController.getAlerts);
router.put('/:id', protect, adminOnly, alertController.updateAlert);
router.delete('/:id', protect, adminOnly, alertController.deleteAlert);
router.post('/:id/trigger', protect, adminOnly, alertController.triggerAlert);
router.post('/:id/history/:historyId/acknowledge', protect, adminOnly, alertController.acknowledgeAlert);

export default router;
