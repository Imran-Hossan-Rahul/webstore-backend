import mongoose from 'mongoose';

const marketOrderSchema = new mongoose.Schema({
  user_id: {
    type: String, // Nullable for guest
  },
  phone: {
    type: String, // Essential for guest checkout
  },
  address: {
    type: String, // JSON string of division -> district -> upazila
    required: true,
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
  source_channel: {
    type: String,
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
