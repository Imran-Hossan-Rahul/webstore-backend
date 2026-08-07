import express from 'express';
import * as wholesalerController from '../controllers/marketWholesalerController.js';
import * as productController from '../controllers/marketProductController.js';
import * as orderController from '../controllers/marketOrderController.js';
import * as procurementController from '../controllers/marketProcurementController.js';
import * as bannerController from '../controllers/marketBannerController.js';
import * as categoryController from '../controllers/marketCategoryController.js';
import * as configController from '../controllers/marketConfigController.js';
import * as deliveryController from '../controllers/marketDeliveryController.js';

import { protect, adminOnly, optionalProtect } from '../middlewares/authMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import marketMediaUpload from '../config/marketMulter.js';

const router = express.Router();

// Config
router.get('/config', configController.getMarketConfig);
router.put('/config', protect, adminOnly, configController.updateMarketConfig);

// Banners
router.get('/banners', cacheMiddleware(300), bannerController.getBanners);
router.get('/banners/all', protect, adminOnly, bannerController.getAllBanners);
router.post('/banners', protect, adminOnly, marketMediaUpload.single('image'), bannerController.createBanner);
router.put('/banners/:id', protect, adminOnly, marketMediaUpload.single('image'), bannerController.updateBanner);
router.delete('/banners/:id', protect, adminOnly, bannerController.deleteBanner);

// Categories
router.get('/categories', cacheMiddleware(300), categoryController.getCategories);
router.get('/categories/all', protect, adminOnly, categoryController.getAllCategories);
router.post('/categories', protect, adminOnly, marketMediaUpload.single('image'), categoryController.createCategory);
router.put('/categories/:id', protect, adminOnly, marketMediaUpload.single('image'), categoryController.updateCategory);
router.delete('/categories/:id', protect, adminOnly, categoryController.deleteCategory);

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
router.delete('/products/:id', protect, adminOnly, productController.deleteProduct);
router.get('/products/:id', optionalProtect, productController.getProductById);
router.put('/products/:id/like', protect, productController.likeProduct);

// Orders
router.get('/orders/all', protect, adminOnly, orderController.getAllOrders);
router.get('/orders', protect, orderController.getOrders);
router.post('/orders', protect, orderController.createOrder);
router.post('/orders/guest', orderController.createGuestOrder);
router.post('/orders/guest/list', orderController.getGuestOrders);
router.post('/orders/guest/track', orderController.trackGuestOrder);
router.patch('/orders/:id/status', protect, adminOnly, orderController.updateOrderStatus);

// Procurement
router.get('/procurement/candidates', protect, adminOnly, procurementController.getProcurementCandidates);
router.post('/procurement/run', protect, adminOnly, procurementController.createProcurementRun);


// Delivery
router.post('/delivery/calculate', deliveryController.calculateDelivery);

export default router;
