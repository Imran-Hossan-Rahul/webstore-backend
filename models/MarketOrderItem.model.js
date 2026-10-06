import mongoose from 'mongoose';

const marketOrderItemSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketOrder',
    required: true,
    index: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProduct',
  },
  product_name: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price_at_purchase: {
    type: Number,
    required: true,
  },
  procurement_run_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProcurementRun',
    index: true,
  },
  variants: {
    type: String,
  },
  license_key: {
    type: String,
  },
  download_token: {
    type: String,
  },
  download_expires_at: {
    type: Date,
  },
  download_attempts: {
    type: Number,
    default: 0,
  },
  max_downloads: {
    type: Number,
    default: 3,
  },
  bound_domain: {
    type: String, // Tracks which domain this license is locked to
  },
  license_status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true,
});

const MarketOrderItem = mongoose.models.MarketOrderItem || mongoose.model('MarketOrderItem', marketOrderItemSchema);

export default MarketOrderItem;
