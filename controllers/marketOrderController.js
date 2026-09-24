import MarketOrder from '../models/MarketOrder.model.js';
import MarketOrderItem from '../models/MarketOrderItem.model.js';
import MarketProduct from '../models/MarketProduct.model.js';
import { sendDigitalFulfillmentEmail } from '../services/email.service.js';
import crypto from 'crypto';
import { CLIENT_URL } from '../config/index.js';

// Admin: get ALL orders across all users
export const getAllOrders = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const orders = await MarketOrder.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const allOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: allOrderIds } }).populate('product_id').lean();

    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          return { ...item, id: item._id, product };
        })
      };
    });

    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const orders = await MarketOrder.find({ user_id: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    
    // We need to fetch items manually since we are using .lean() without complex aggregation
    const allOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: allOrderIds } }).populate('product_id').lean();
    
    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          return { ...item, id: item._id, product };
        })
      };
    });
    
    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { phone, address, items, source_channel, delivery_charge, discount_amount, subtotal, total_amount } = req.body;
    const userId = req.user._id.toString();
    
    // Create the main order
    const order = await MarketOrder.create({
      user_id: userId,
      phone,
      address, // Save as object directly (requires model update to match)
      status: 'Order placed',
      source_channel,
      delivery_charge: delivery_charge || 0,
      discount_amount: discount_amount || 0,
      subtotal: subtotal || 0,
      total_amount: total_amount || 0
    });
    
    // Create the items referencing the order
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const orderItemsToCreate = items.map(item => ({
      order_id: order._id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
      variants: item.variants,
      license_key: crypto.randomUUID().toUpperCase(),
      download_token: crypto.randomBytes(16).toString('hex'),
      download_expires_at: expiresAt,
      download_attempts: 0,
      max_downloads: 5
    }));
    
    const createdItems = await MarketOrderItem.insertMany(orderItemsToCreate);
    
    const result = order.toObject();
    result.id = result._id;
    result.items = createdItems.map(item => {
      const obj = item.toObject();
      obj.id = obj._id;
      return obj;
    });
    
    // Digital Fulfillment: Send Email
    try {
      const productIds = createdItems.map(item => item.product_id);
      const products = await MarketProduct.find({ _id: { $in: productIds } }).lean();
      
      const emailItems = createdItems.map(item => {
        const prod = products.find(p => p._id.toString() === item.product_id.toString());
        return {
          productName: prod ? prod.title : 'Digital Product',
          licenseKey: item.license_key,
          downloadUrl: `${CLIENT_URL}/api/market/download/${item.download_token}` // Proxy endpoint
        };
      });

      // Assuming user email is available in req.user, otherwise check if they passed it
      const email = req.user?.email || req.body.email; 
      const name = req.user?.name || req.body.customer_name || 'Customer';
      
      if (email) {
        await sendDigitalFulfillmentEmail(email, name, result.id.toString().slice(-6).toUpperCase(), emailItems);
      }
    } catch (err) {
      console.error('Fulfillment email failed:', err);
    }
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createGuestOrder = async (req, res) => {
  try {
    const { phone, address, items, source_channel, delivery_charge, discount_amount, subtotal, total_amount } = req.body;
    
    // Create the main order without user_id
    const order = await MarketOrder.create({
      user_id: null,
      phone,
      address, 
      status: 'Order placed',
      source_channel,
      delivery_charge: delivery_charge || 0,
      discount_amount: discount_amount || 0,
      subtotal: subtotal || 0,
      total_amount: total_amount || 0
    });
    
    // Create the items referencing the order
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const orderItemsToCreate = items.map(item => ({
      order_id: order._id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
      variants: item.variants,
      license_key: crypto.randomUUID().toUpperCase(),
      download_token: crypto.randomBytes(16).toString('hex'),
      download_expires_at: expiresAt,
      download_attempts: 0,
      max_downloads: 5
    }));
    
    const createdItems = await MarketOrderItem.insertMany(orderItemsToCreate);
    
    const result = order.toObject();
    result.id = result._id;
    result.items = createdItems.map(item => {
      const obj = item.toObject();
      obj.id = obj._id;
      return obj;
    });
    
    // Digital Fulfillment: Send Email
    try {
      const productIds = createdItems.map(item => item.product_id);
      const products = await MarketProduct.find({ _id: { $in: productIds } }).lean();
      
      const emailItems = createdItems.map(item => {
        const prod = products.find(p => p._id.toString() === item.product_id.toString());
        return {
          productName: prod ? prod.title : 'Digital Product',
          licenseKey: item.license_key,
          downloadUrl: `${CLIENT_URL}/api/market/download/${item.download_token}` // Proxy endpoint
        };
      });

      const email = req.body.email; 
      const name = req.body.customer_name || 'Customer';
      
      if (email) {
        await sendDigitalFulfillmentEmail(email, name, result.id.toString().slice(-6).toUpperCase(), emailItems);
      }
    } catch (err) {
      console.error('Guest fulfillment email failed:', err);
    }
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getGuestOrders = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json([]);
    }

    const orders = await MarketOrder.find({ _id: { $in: ids } }).sort({ createdAt: -1 }).lean();
    const foundOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: foundOrderIds } }).populate('product_id').lean();
    
    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          return { ...item, id: item._id, product };
        })
      };
    });
    
    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const trackGuestOrder = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Order ID or Phone Number is required.' });
    }

    const searchQuery = query.trim();
    
    let orders = [];

    // Check if query is a valid MongoDB ObjectId
    const mongoose = await import('mongoose');
    if (mongoose.isValidObjectId(searchQuery)) {
      const orderById = await MarketOrder.findOne({ _id: searchQuery }).lean();
      if (orderById) orders.push(orderById);
    } else if (searchQuery.toUpperCase().startsWith('WA') && searchQuery.length === 10) {
      // It's a short ID like WAFA2AC00F
      const shortId = searchQuery.toUpperCase().slice(2);
      // Use aggregation pipeline to match the end of the _id string
      const matchedOrders = await MarketOrder.aggregate([
        {
          $addFields: {
            extractedShortId: { $toUpper: { $substr: [ { $toString: "$_id" }, 16, 8 ] } }
          }
        },
        {
          $match: {
            extractedShortId: shortId
          }
        }
      ]);
      orders = matchedOrders;
    }
    
    // If no order found by ID, search by phone (Exact match required)
    if (orders.length === 0) {
      const ordersByPhone = await MarketOrder.find({ phone: searchQuery }).sort({ createdAt: -1 }).lean();
      orders = ordersByPhone;
    }

    if (orders.length === 0) {
      return res.status(404).json({ error: 'No orders found matching this ID or Phone Number.' });
    }

    const foundOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: foundOrderIds } }).populate('product_id').lean();

    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          return { ...item, id: item._id, product };
        })
      };
    });
    
    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status, courier_name, tracking_id } = req.body;
    const updateData = { status };
    if (status === 'Confirmed') updateData.confirmed_at = new Date();
    if (courier_name) updateData.courier_name = courier_name;
    if (tracking_id) updateData.tracking_id = tracking_id;
    
    const order = await MarketOrder.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean();
    if(order) order.id = order._id;
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const downloadDigitalProduct = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const orderItem = await MarketOrderItem.findOne({ download_token: token }).populate('product_id');
    if (!orderItem) {
      return res.status(404).json({ error: 'Invalid or expired download token' });
    }

    if (!orderItem.product_id || !orderItem.product_id.downloadUrl) {
      return res.status(404).json({ error: 'Digital product file not found' });
    }

    // Check expiry
    if (new Date() > new Date(orderItem.download_expires_at)) {
      return res.status(403).json({ error: 'Download link has expired. Please request a new one from your orders page.' });
    }

    // Check attempts
    if (orderItem.download_attempts >= orderItem.max_downloads) {
      return res.status(403).json({ error: 'Maximum download attempts reached.' });
    }

    // Increment attempts
    orderItem.download_attempts += 1;
    await orderItem.save();

    // Redirect to the actual signed URL or Cloudinary URL
    return res.redirect(orderItem.product_id.downloadUrl);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to process download request' });
  }
};
