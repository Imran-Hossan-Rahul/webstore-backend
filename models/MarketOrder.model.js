import mongoose from 'mongoose';

const marketOrderSchema = new mongoose.Schema({
  user_id: {
    type: String, // Nullable for guest
  },
  phone: {
    type: String, // Essential for guest checkout
  },
  email: {
    type: String, // Essential for digital delivery
  },
  customer_name: {
    type: String, // Essential for digital delivery
  },
  address: {
    type: Object, // division, district, upazila (now optional)
  },
  status: {
    type: String,
    enum: ['Order placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    required: true,
    index: true,
  },
  courier_name: {
    type: String,
  },
  tracking_id: {
    type: String,
  },
  delivery_charge: {
    type: Number,
    default: 0
  },
  discount_amount: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    default: 0
  },
  source_channel: {
    type: String,
  },
  payment_method: {
    type: String,
    default: 'Cash on Delivery'
  },
  payment_number: {
    type: String,
  },
  payment_trx_id: {
    type: String,
  },
  payment_status: {
    type: String,
    enum: ['Pending', 'Verified', 'Failed'],
    default: 'Pending'
  },
  payment_due: {
    type: Number,
    default: 0
  },
  confirmed_at: {
    type: Date,
  }
}, {
  timestamps: true,
});

marketOrderSchema.virtual('items', {
  ref: 'MarketOrderItem',
  localField: '_id',
  foreignField: 'order_id',
});

marketOrderSchema.set('toObject', { virtuals: true });
marketOrderSchema.set('toJSON', { virtuals: true });

const MarketOrder = mongoose.models.MarketOrder || mongoose.model('MarketOrder', marketOrderSchema);

export default MarketOrder;
