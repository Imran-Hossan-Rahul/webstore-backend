import MarketProduct from '../models/MarketProduct.model.js';
import MarketOrderItem from '../models/MarketOrderItem.model.js';
import MarketWholesaler from '../models/MarketWholesaler.model.js';
import MarketOrder from '../models/MarketOrder.model.js';
import MarketProcurementRun from '../models/MarketProcurementRun.model.js';
import MarketWholesalerTransaction from '../models/MarketWholesalerTransaction.model.js';

export const getProcurementCandidates = async (req, res) => {
  try {
    const products = await MarketProduct.find().populate('wholesaler_id').lean();
    
    const unprocuredItems = await MarketOrderItem.find({ procurement_run_id: null })
      .populate('order_id')
      .lean();
      
    const confirmedItems = unprocuredItems.filter(item => item.order_id && item.order_id.status === 'Confirmed');
    
    const candidates = products.map(p => {
      const pItems = confirmedItems.filter(item => item.product_id.toString() === p._id.toString());
      return {
        ...p,
        id: p._id,
        wholesaler: p.wholesaler_id ? { ...p.wholesaler_id, id: p.wholesaler_id._id } : null,
        orderItems: pItems.map(item => ({...item, id: item._id, order: {...item.order_id, id: item.order_id._id}}))
      };
    }).filter(p => p.orderItems.length >= p.procurement_threshold);
    
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProcurementRun = async (req, res) => {
  try {
    const { wholesaler_id, order_item_ids } = req.body;
    
    const items = await MarketOrderItem.find({ _id: { $in: order_item_ids } }).populate('product_id');

    const total_cost = items.reduce((acc, item) => acc + (item.product_id.cost_price * item.quantity), 0);
    const wholesaler = await MarketWholesaler.findById(wholesaler_id);

    const run = await MarketProcurementRun.create({
      wholesaler_id,
      total_cost,
      payment_status: wholesaler.payment_arrangement === 'pay_on_collection' ? 'Paid' : 'Pending',
    });

    // Update the OrderItems to reference this run
    await MarketOrderItem.updateMany(
      { _id: { $in: order_item_ids } },
      { $set: { procurement_run_id: run._id } }
    );

    // Update Wholesaler Ledger
    if (wholesaler.payment_arrangement === 'pay_after_cod') {
      await MarketWholesaler.findByIdAndUpdate(wholesaler_id, {
        $inc: { running_balance: total_cost }
      });
      await MarketWholesalerTransaction.create({
        wholesaler_id, amount: total_cost, type: 'owed', linked_run_id: run._id
      });
    } else {
      await MarketWholesalerTransaction.create({
        wholesaler_id, amount: total_cost, type: 'paid', linked_run_id: run._id
      });
    }

    const orderIds = items.map(i => i.order_id);
    await MarketOrder.updateMany(
      { _id: { $in: orderIds } },
      { $set: { status: 'Processing' } }
    );
    
    const result = run.toObject();
    result.id = result._id;
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
