import mongoose from 'mongoose';
import MarketOrder from '../models/MarketOrder.model.js';
import MarketOrderItem from '../models/MarketOrderItem.model.js';
import MarketProduct from '../models/MarketProduct.model.js';
import User from '../models/User.model.js';
import { createBulkNotifications } from './notificationController.js';
import { sendDigitalFulfillmentEmail } from '../services/email.service.js';
import crypto from 'crypto';
import { CLIENT_URL } from '../config/index.js';
import { createBuildFingerprint, streamWatermarkedZip } from '../services/watermarkService.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import axios from 'axios';
import extract from 'extract-zip';
import MarketLicense from '../models/MarketLicense.model.js';
import { hashLicenseKey } from '../utils/crypto.js';

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

// Single order with items — admin, or the customer who owns it
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }
    const order = await MarketOrder.findById(id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isOwner = order.user_id && order.user_id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Unauthorized' });

    const items = await MarketOrderItem.find({ order_id: order._id }).populate('product_id').lean();
    res.json({
      ...order,
      id: order._id,
      items: items.map(item => ({
        ...item,
        id: item._id,
        product: item.product_id ? { ...item.product_id, id: item.product_id._id } : null
      }))
    });
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
      const isVerified = order.status !== 'Pending Verification';
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          const itemObj = { ...item, id: item._id, product };
          if (!isVerified) {
             delete itemObj.license_key;
             delete itemObj.download_token;
          }
          return itemObj;
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
    const { phone, email, name, address, items, source_channel, delivery_charge, discount_amount, subtotal, total_amount, payment_method, payment_number, payment_trx_id } = req.body;
    const userId = req.user._id.toString();
    
    // Create the main order
    const order = await MarketOrder.create({
      user_id: userId,
      phone,
      email,
      customer_name: name,
      address, // Save as object directly (requires model update to match)
      status: payment_method === 'bkash_manual' ? 'Pending Verification' : 'Order placed',
      source_channel,
      delivery_charge: delivery_charge || 0,
      discount_amount: discount_amount || 0,
      subtotal: subtotal || 0,
      total_amount: total_amount || 0,
      payment_method: payment_method || 'Cash on Delivery',
      payment_number,
      payment_trx_id
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
    if (order.payment_method !== 'bkash_manual') {
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
    }
    
    // Notify Admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }, '_id').lean();
      if (admins.length > 0) {
        const adminIds = admins.map(a => a._id);
        const orderIdShort = order._id.toString().slice(-6).toUpperCase();
        await createBulkNotifications(adminIds, {
           title: `New Order (#${orderIdShort})`,
           message: `${name || 'A customer'} placed an order for ৳${total_amount}.`,
           type: 'order',
           actionUrl: `/admin/orders`
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify admins for new order:", notifErr);
    }
    
    // Auto-create Chat Room and send confirmation message
    try {
      const Chat = (await import('../models/Chat.model.js')).default;
      const Message = (await import('../models/Message.model.js')).default;

      // Find an admin to be the sender of the automated message
      const adminUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }).sort({ role: -1 }).select('_id');
      const adminId = adminUser ? adminUser._id : null;

      if (adminId) {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select("_id").lean();
        const participantIds = [userId, ...admins.map(a => a._id.toString())]
          .filter((id, idx, arr) => arr.indexOf(id) === idx);

        let chat = await Chat.create({ participants: participantIds, orderId: order._id });
        await MarketOrder.updateOne({ _id: order._id }, { $set: { collaborationRoomId: chat._id.toString() } });

        const orderIdShort = order._id.toString().slice(-6).toUpperCase();
        let productDetails = '';
        if (createdItems && createdItems.length > 0) {
           const productIds = createdItems.map(item => item.product_id);
           const products = await MarketProduct.find({ _id: { $in: productIds } }).select("title").lean();
           productDetails = products.map(p => p.title).join(', ');
        }
        
        const welcomeText = `Hello! You've just ordered: ${productDetails} (Order #${orderIdShort}).\n\nYour order will be verified shortly. After verification, you will receive your download link and license details right here in this chat.`;
        
        const newMessage = await Message.create({
          chatId: chat._id,
          sender: adminId,
          content: welcomeText,
          type: "text",
        });

        chat.lastMessage = {
          content: welcomeText,
          sender: adminId,
          createdAt: newMessage.createdAt
        };
        await chat.save();
        
        // Emit socket events so clients update their UI
        const io = req.app.get("io");
        if (io) {
          const populatedMessage = await Message.findById(newMessage._id).populate("sender", "username name profilePicture");
          io.to(chat._id.toString()).emit("message:new", populatedMessage);
          chat.participants.forEach((participantId) => {
            if (participantId.toString() !== adminId.toString()) {
              io.emit(`user:${participantId.toString()}:newMessage`, { chatId: chat._id.toString(), message: populatedMessage });
            }
          });
        }
      }
    } catch (chatErr) {
      console.error("Failed to create automated order chat:", chatErr);
    }
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createGuestOrder = async (req, res) => {
  try {
    const { phone, email, name, address, items, source_channel, delivery_charge, discount_amount, subtotal, total_amount, payment_method, payment_number, payment_trx_id } = req.body;
    
    // Create the main order without user_id
    const order = await MarketOrder.create({
      user_id: null,
      phone,
      email,
      customer_name: name,
      address, 
      status: payment_method === 'bkash_manual' ? 'Pending Verification' : 'Order placed',
      source_channel,
      delivery_charge: delivery_charge || 0,
      discount_amount: discount_amount || 0,
      subtotal: subtotal || 0,
      total_amount: total_amount || 0,
      payment_method: payment_method || 'Cash on Delivery',
      payment_number,
      payment_trx_id
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
    if (order.payment_method !== 'bkash_manual') {
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
    }
    
    // Notify Admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }, '_id').lean();
      if (admins.length > 0) {
        const adminIds = admins.map(a => a._id);
        const orderIdShort = order._id.toString().slice(-6).toUpperCase();
        await createBulkNotifications(adminIds, {
           title: `New Guest Order (#${orderIdShort})`,
           message: `${name || 'A customer'} placed a guest order for ৳${total_amount}.`,
           type: 'order',
           actionUrl: `/admin/orders`
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify admins for new guest order:", notifErr);
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
      const isVerified = order.status !== 'Pending Verification';
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          const itemObj = { ...item, id: item._id, product };
          if (!isVerified) {
             delete itemObj.license_key;
             delete itemObj.download_token;
          }
          return itemObj;
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
      const isVerified = order.status !== 'Pending Verification';
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => {
          const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
          if (product && Array.isArray(product.photos)) {
            product.photos = JSON.stringify(product.photos);
          }
          const itemObj = { ...item, id: item._id, product };
          if (!isVerified) {
             delete itemObj.license_key;
             delete itemObj.download_token;
          }
          return itemObj;
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
    const { status, projectPhase, courier_name, tracking_id } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (projectPhase) updateData.projectPhase = projectPhase;
    if (status === 'Confirmed') {
      updateData.confirmed_at = new Date();
      updateData.payment_status = 'Verified';
    }
    if (status === 'Payment Failed') {
        updateData.payment_status = 'Failed';
      }
      if (status === 'Pending') {
        updateData.payment_status = 'Pending';
      }
      if (status === 'Payment Failed') {
      updateData.payment_status = 'Failed';
    }
    if (courier_name) updateData.courier_name = courier_name;
    if (tracking_id) updateData.tracking_id = tracking_id;
    
    // Fetch current order to check if we are transitioning to Confirmed
    const currentOrder = await MarketOrder.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = await MarketOrder.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).lean();
    if(order) order.id = order._id;

    // Trigger Digital Fulfillment Email if transitioning to Confirmed for a manual bkash order
    if (status === 'Confirmed' && currentOrder.status !== 'Confirmed') {
      try {
        const items = await MarketOrderItem.find({ order_id: req.params.id }).lean();
        const productIds = items.map(item => item.product_id);
        const products = await MarketProduct.find({ _id: { $in: productIds } }).lean();
        
        // --- PHASE 4: Create MarketLicenses ---
        for (const item of items) {
          const hashedKey = hashLicenseKey(item.license_key);
          const existingLicense = await MarketLicense.findOne({ license_key_hash: hashedKey });
          
          if (!existingLicense) {
            let assignedTier = 'Personal';
            let assignedActivations = 1;
            
            const variantStr = (item.variants || '').toLowerCase();
            if (variantStr.includes('extended')) {
              assignedTier = 'Extended';
              assignedActivations = 9999; // Unlimited/High
            } else if (variantStr.includes('commercial')) {
              assignedTier = 'Commercial';
              assignedActivations = 1;
            }

            await MarketLicense.create({
              order_id: order._id,
              customer_id: order.user_id || null, // Guest orders have null
              product_id: item.product_id,
              license_key_hash: hashedKey,
              tier: assignedTier, 
              max_activations: assignedActivations, 
              support_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              updates_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
          }
        }
        // ----------------------------------------
        
        const emailItems = items.map(item => {
          const prod = products.find(p => p._id.toString() === item.product_id.toString());
          return {
            productName: prod ? prod.title : 'Digital Product',
            licenseKey: item.license_key,
            downloadUrl: `${CLIENT_URL}/api/market/download/${item.download_token}`
          };
        });

        // Use the order's stored user email if present (assumes MarketOrder has user_id populated or email stored directly)
        // Let's check if the order has an email or we can fetch the user's email
        const User = (await import('../models/User.model.js')).default;
        let customerEmail = order.email;
        let customerName = order.customer_name || 'Customer';
        
        if (!customerEmail && order.user_id) {
          const userObj = await User.findById(order.user_id).lean();
          if (userObj) {
            customerEmail = userObj.email;
            customerName = userObj.name || customerName;
          }
        }

        if (customerEmail) {
          await sendDigitalFulfillmentEmail(customerEmail, customerName, order.id.toString().slice(-6).toUpperCase(), emailItems);
        }
      } catch (err) {
        console.error('Manual confirmation fulfillment email failed:', err);
      }
    }
    
                // Automated status change messages
      if (order.collaborationRoomId) {
        try {
          const Chat = (await import('../models/Chat.model.js')).default;
          const Message = (await import('../models/Message.model.js')).default;
          const User = (await import('../models/User.model.js')).default;
          const chat = await Chat.findById(order.collaborationRoomId);
          
          if (chat) {
            const adminUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }).sort({ role: -1 }).select('_id');
            if (adminUser) {
              let automatedMsg = null;
              
              if (order.payment_status === 'Verified' && currentOrder.payment_status !== 'Verified') {
                automatedMsg = "Your payment has been successfully verified!\n\nYour download links and license details are now available in the order details panel.\n\nFor more information, please message this chat or the Codalina Support chat.";
              } else if (order.status === 'Delivered' && currentOrder.status !== 'Delivered') {
                automatedMsg = "Great news! Your order has been marked as Delivered!\n\nWe hope you're satisfied with your purchase.\n\nFor more information or if you need any further assistance, please message this chat or the Codalina Support chat.";
              } else if (order.status === 'Suspended' && currentOrder.status !== 'Suspended') {
                automatedMsg = "Notice: Your order has been Suspended.\n\nThere seems to be an issue with your order. Please review your details.\n\nFor more information, please message this chat or the Codalina Support chat.";
              } else if (order.projectPhase && order.projectPhase !== currentOrder.projectPhase && order.projectPhase !== 'Not applicable') {
                automatedMsg = "Project Update: The phase of your project has been updated to \"" + order.projectPhase + "\".\n\nWe are making progress on your order. You can check the current status in your order details.\n\nFor more information, please message this chat or the Codalina Support chat.";
              }
              
              if (automatedMsg) {
                const newMessage = await Message.create({
                  chatId: chat._id,
                  sender: adminUser._id,
                  content: automatedMsg,
                  type: "text",
                });
    
                chat.lastMessage = {
                  content: automatedMsg,
                  sender: adminUser._id,
                  createdAt: newMessage.createdAt
                };
                await chat.save();
                
                const io = req.app.get("io");
                if (io) {
                  const populatedMessage = await Message.findById(newMessage._id).populate("sender", "username name profilePicture");
                  io.to(chat._id.toString()).emit("message:new", populatedMessage);
                  chat.participants.forEach((participantId) => {
                    if (participantId.toString() !== adminUser._id.toString()) {
                      io.emit(`user:${participantId.toString()}:newMessage`, { chatId: chat._id.toString(), message: populatedMessage });
                    }
                  });
                }
              }
            }
          }
        } catch (chatErr) {
          console.error("Failed to send status update chat message:", chatErr);
        }
      }




    
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

    if (!orderItem.product_id) {
      return res.status(404).json({ error: 'Digital product not found' });
    }

    // Check expiry
    if (new Date() > new Date(orderItem.download_expires_at)) {
      return res.status(403).json({ error: 'Download link has expired. Please request a new one from your orders page.' });
    }

    // Check attempts
    if (orderItem.download_attempts >= orderItem.max_downloads) {
      return res.status(403).json({ error: 'Maximum download attempts reached. Please contact support.' });
    }

    // Attach listener to increment ONLY on successful complete download
    const tmpDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const zipPath = path.join(tmpDir, `${uniqueId}.zip`);
    const extractPath = path.join(tmpDir, uniqueId);

    res.on('finish', async () => {
      // Cleanup temp files regardless of success or failure of stream
      try {
        if (await fs.pathExists(zipPath)) await fs.remove(zipPath);
        if (await fs.pathExists(extractPath)) await fs.remove(extractPath);
      } catch (cleanupErr) {
        console.error('Failed to cleanup temp download files:', cleanupErr);
      }

      // If the file was fully sent to the operating system for transmission
      if (res.statusCode === 200) {
        try {
          orderItem.download_attempts += 1;
          await orderItem.save();
          console.log(`Download successful for token ${token}. Attempt ${orderItem.download_attempts}/${orderItem.max_downloads}`);
        } catch (err) {
          console.error('Failed to increment download count:', err);
        }
      }
    });

    // ---------------------------------------------------------
    // PHASE 2: Watermarking & Secure Delivery Pipeline
    // ---------------------------------------------------------

    // 1. Generate fingerprint and canary token
    const fingerprint = await createBuildFingerprint(orderItem._id);

    // 2. Download or locate the original ZIP
    const downloadUrl = orderItem.product_id.downloadUrl;
    if (!downloadUrl) {
      return res.status(404).json({ error: 'Source file not found for this product.' });
    }

    let zipPathToExtract;

    if (downloadUrl.startsWith('/uploads')) {
      // Local file
      zipPathToExtract = path.resolve(downloadUrl.replace(/^\//, ''));
      if (!(await fs.pathExists(zipPathToExtract))) {
        return res.status(404).json({ error: 'Source file is missing on the server.' });
      }
    } else {
      // Legacy Cloudinary file
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      zipPathToExtract = zipPath;
    }

    // 3. Extract the ZIP
    await extract(zipPathToExtract, { dir: extractPath });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${orderItem.product_id.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_licensed.zip"`);

    // 4. Stream the dynamically generated ZIP (from the extracted folder)
    await streamWatermarkedZip(res, extractPath, fingerprint);

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process download request' });
    }
  }
};

export const verifyLicense = async (req, res) => {
  try {
    const { license_key, domain } = req.body;
    
    if (!license_key || !domain) {
      return res.status(400).json({ valid: false, error: 'license_key and domain are required' });
    }

    const orderItem = await MarketOrderItem.findOne({ license_key });
    
    if (!orderItem) {
      return res.status(404).json({ valid: false, error: 'Invalid license key' });
    }

    if (orderItem.license_status === 'suspended') {
      return res.status(403).json({ valid: false, error: 'License is suspended' });
    }

    // Check if domain is already bound
    if (orderItem.bound_domain) {
      if (orderItem.bound_domain !== domain) {
        return res.status(403).json({ valid: false, error: `License is already bound to another domain` });
      }
    } else {
      // Bind domain if empty
      orderItem.bound_domain = domain;
      await orderItem.save();
    }

    return res.status(200).json({ valid: true, message: 'License verified successfully', domain: orderItem.bound_domain });
  } catch (error) {
    console.error('Verify license error:', error);
    res.status(500).json({ valid: false, error: 'Failed to verify license' });
  }
};




﻿export const submitCustomBrief = async (req, res) => {
  try {
    let userId = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
       try {
         const jwt = (await import('jsonwebtoken')).default;
         const token = req.headers.authorization.split(' ')[1];
         const decoded = jwt.verify(token, process.env.JWT_SECRET);
         userId = decoded.id;
       } catch (err) {}
    } else if (req.cookies && req.cookies.access_token) {
       try {
         const jwt = (await import('jsonwebtoken')).default;
         const decoded = jwt.verify(req.cookies.access_token, process.env.JWT_SECRET);
         userId = decoded.id;
       } catch (err) {}
    }

    const { name, email, projectType, budget, timeline, projectDetails } = req.body;
    
    // Create the main order
    const order = await MarketOrder.create({
      user_id: userId,
      phone: '',
      email,
      customer_name: name,
      status: 'Pending Verification',
      projectPhase: 'Discovery',
      source_channel: 'Custom Brief',
      delivery_charge: 0,
      discount_amount: 0,
      subtotal: 0,
      total_amount: 0,
      payment_method: 'Custom Project',
    });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const createdItem = await MarketOrderItem.create({
      order_id: order._id,
      product_id: null,
      product_name: 'Custom Project Brief: ' + projectType,
      quantity: 1,
      price_at_purchase: 0,
      license_key: (await import('crypto')).default.randomUUID().toUpperCase(),
      download_token: (await import('crypto')).default.randomBytes(16).toString('hex'),
      download_expires_at: expiresAt,
      download_attempts: 0,
      max_downloads: 5
    });

    const result = order.toObject();
    result.id = result._id;
    const obj = createdItem.toObject();
    obj.id = obj._id;
    result.items = [obj];

    // Notify Admins
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id').lean();
      if (admins.length > 0) {
        const adminIds = admins.map(a => a._id);
        const orderIdShort = order._id.toString().slice(-6).toUpperCase();
        await createBulkNotifications(adminIds, {
           title: `New Custom Brief (#${orderIdShort})`,
           message: `${name || 'A user'} submitted a brief: ${projectType}.`,
           type: 'order',
           actionUrl: `/admin/orders`
        });
      }
    } catch (notifErr) {}
    
    // Create Collaboration Room
    try {
      const Chat = (await import('../models/Chat.model.js')).default;
      const Message = (await import('../models/Message.model.js')).default;

      const adminUser = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }).sort({ role: -1 }).select('_id');
      const adminId = adminUser ? adminUser._id : null;

      if (adminId) {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id').lean();
        const participantIds = [];
        if (userId) participantIds.push(userId.toString());
        admins.forEach(a => participantIds.push(a._id.toString()));
        const uniqueParticipants = [...new Set(participantIds)];

        let chat = await Chat.create({ participants: uniqueParticipants, orderId: order._id });
        await MarketOrder.updateOne({ _id: order._id }, { $set: { collaborationRoomId: chat._id.toString() } });

        const orderIdShort = order._id.toString().slice(-6).toUpperCase();
        const welcomeText = `Hello ${name || 'there'}! We've received your brief for "${projectType}" (Ref #${orderIdShort}).\n\n**Budget:** ${budget || 'N/A'}\n**Timeline:** ${timeline || 'N/A'}\n**Details:** ${projectDetails || 'N/A'}\n\nOur lead engineers will review this and get back to you here shortly!`;
        
        const newMessage = await Message.create({
          chatId: chat._id,
          sender: adminId,
          content: welcomeText,
          type: 'text',
        });

        chat.lastMessage = {
          content: welcomeText,
          sender: adminId,
          createdAt: newMessage.createdAt
        };
        await chat.save();
        
        const io = req.app.get('io');
        if (io) {
          const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username name profilePicture');
          io.to(chat._id.toString()).emit('message:new', populatedMessage);
          chat.participants.forEach((participantId) => {
            if (participantId.toString() !== adminId.toString()) {
              io.to(participantId.toString()).emit('chat:update', { ...chat.toObject(), lastMessage: { content: welcomeText, sender: populatedMessage.sender, createdAt: newMessage.createdAt } });
            }
          });
        }
      }
    } catch (chatErr) {}
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
