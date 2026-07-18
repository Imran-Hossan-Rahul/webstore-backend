import MarketOrder from '../models/MarketOrder.model.js';
import MarketOrderItem from '../models/MarketOrderItem.model.js';

// Admin: get ALL orders across all users
export const getAllOrders = async (req, res) => {
  try {
    const orders = await MarketOrder.find().sort({ createdAt: -1 }).lean();
    const allOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: allOrderIds } }).populate('product_id').lean();

    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => ({
          ...item,
          id: item._id,
          product: item.product_id ? { ...item.product_id, id: item.product_id._id } : null
        }))
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
    const orders = await MarketOrder.find({ user_id: userId }).lean();
    
    // We need to fetch items manually since we are using .lean() without complex aggregation
    const allOrderIds = orders.map(o => o._id);
    const allItems = await MarketOrderItem.find({ order_id: { $in: allOrderIds } }).populate('product_id').lean();
    
    const mappedOrders = orders.map(order => {
      const orderItems = allItems.filter(item => item.order_id.toString() === order._id.toString());
      return {
        ...order,
        id: order._id,
        items: orderItems.map(item => ({
          ...item,
          id: item._id,
          product: item.product_id ? { ...item.product_id, id: item.product_id._id } : null
        }))
      };
    });
    
    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { phone, address, items, source_channel } = req.body;
    const userId = req.user._id.toString();
    
    // Create the main order
    const order = await MarketOrder.create({
      user_id: userId,
      phone,
      address: JSON.stringify(address),
      status: 'Order placed',
      source_channel
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
