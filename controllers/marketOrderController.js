import MarketOrder from '../models/MarketOrder.model.js';
import MarketOrderItem from '../models/MarketOrderItem.model.js';

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
    const orderItemsToCreate = items.map(item => ({
      order_id: order._id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
      variants: item.variants
    }));
    
    const createdItems = await MarketOrderItem.insertMany(orderItemsToCreate);
    
    const result = order.toObject();
    result.id = result._id;
    result.items = createdItems.map(item => {
      const obj = item.toObject();
      obj.id = obj._id;
      return obj;
    });
    
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
    const orderItemsToCreate = items.map(item => ({
      order_id: order._id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
      variants: item.variants
    }));
    
    const createdItems = await MarketOrderItem.insertMany(orderItemsToCreate);
    
    const result = order.toObject();
    result.id = result._id;
    result.items = createdItems.map(item => {
      const obj = item.toObject();
      obj.id = obj._id;
      return obj;
    });
    
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
    const { orderId, phone } = req.body;
    if (!orderId || !phone) {
      return res.status(400).json({ error: 'Order ID and Phone Number are required.' });
    }

    const order = await MarketOrder.findOne({ _id: orderId }).lean();
    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please check your Order ID.' });
    }

    // Verify phone number (simple string match, could strip spaces/country codes if needed)
    const dbPhone = order.phone || '';
    const inputPhone = phone || '';
    
    // Normalize phones for comparison (remove spaces, dashes, +88)
    const normalizePhone = (p) => p.replace(/[\s\-\+]/g, '').slice(-10);
    
    if (normalizePhone(dbPhone) !== normalizePhone(inputPhone)) {
      return res.status(403).json({ error: 'Phone number does not match the order records.' });
    }

    const items = await MarketOrderItem.find({ order_id: order._id }).populate('product_id').lean();
    
    const mappedOrder = {
      ...order,
      id: order._id,
      items: items.map(item => {
        const product = item.product_id ? { ...item.product_id, id: item.product_id._id } : null;
        if (product && Array.isArray(product.photos)) {
          product.photos = JSON.stringify(product.photos);
        }
        return { ...item, id: item._id, product };
      })
    };
    
    res.json(mappedOrder);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ error: 'Invalid Order ID format.' });
    }
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
