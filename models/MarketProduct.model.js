import mongoose from 'mongoose';

const marketProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  photos: {
    type: String, // Storing as JSON stringified array of URLs for compatibility with previous schema
    required: true,
  },
  category_id: {
    type: String,
  },
  subCategory_id: {
    type: String,
  },
  childCategory_id: {
    type: String,
  },
  sku: {
    type: String,
  },
  brand: {
    type: String,
  },
  weight: {
    type: Number,
  },
  dimensions: {
    type: String,
  },
  tags: {
    type: String,
  },
  cost_price: {
    type: Number,
    required: true,
  },
  original_price: {
    type: Number, // MSRP / Striken-through price
  },
  selling_price: {
    type: Number,
    required: true,
  },
  specifications: {
    type: String, // Storing as JSON stringified array of {key, value} objects
  },
  variantGroups: {
    type: String, // JSON stringified array: [{ name: "Color", options: [{ label: "Lavender", priceDifference: 0, imageIndex: 0 }] }]
  },
  warranty_info: {
    type: String,
  },
  return_policy: {
    type: String,
  },
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketWholesaler',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Live', 'Threshold reached', 'Paused', 'Sold out'],
    required: true,
    index: true,
  },
  procurement_threshold: {
    type: Number,
    default: 20,
  },
  est_delivery_days: {
    type: Number,
    default: 3,
  },
  reportedStockQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  groupId: {
    type: String,
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: String
  }]
}, {
  timestamps: true,
});

const MarketProduct = mongoose.models.MarketProduct || mongoose.model('MarketProduct', marketProductSchema);

export default MarketProduct;
