import express from 'express';
import * as wholesalerController from '../controllers/marketWholesalerController.js';
import * as productController from '../controllers/marketProductController.js';
import * as orderController from '../controllers/marketOrderController.js';
import * as procurementController from '../controllers/marketProcurementController.js';

import { protect, adminOnly, optionalProtect } from '../middlewares/authMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import marketMediaUpload from '../config/marketMulter.js';

const router = express.Router();

// Wholesalers
router.get('/wholesalers', cacheMiddleware(300), wholesalerController.getWholesalers);
router.post('/wholesalers', protect, adminOnly, marketMediaUpload.fields([
  { name: 'shopPhotos', maxCount: 5 },
  { name: 'idPhotos', maxCount: 5 }
]), wholesalerController.createWholesaler);
router.get('/wholesalers/:id', wholesalerController.getWholesalerById);

// Products
router.get('/products', cacheMiddleware(300), productController.getProducts);
router.post('/products', protect, adminOnly, marketMediaUpload.array('media', 10), productController.createProduct);
router.put('/products/:id', protect, adminOnly, marketMediaUpload.array('media', 10), productController.updateProduct);
router.post('/products/:id', protect, adminOnly, marketMediaUpload.array('media', 10), productController.updateProduct);
router.get('/products/:id', optionalProtect, productController.getProductById);
router.put('/products/:id/like', protect, productController.likeProduct);

// Orders
router.get('/orders/all', protect, adminOnly, orderController.getAllOrders);
router.get('/orders', protect, orderController.getOrders);
router.post('/orders', protect, orderController.createOrder);
router.patch('/orders/:id/status', protect, adminOnly, orderController.updateOrderStatus);

// Procurement
router.get('/procurement/candidates', procurementController.getProcurementCandidates);
router.post('/procurement/run', procurementController.createProcurementRun);

export default router;
