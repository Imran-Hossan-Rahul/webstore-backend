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
    type: [String],
    default: []
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
  // --- DEPRECATED PHYSICAL FIELDS ---
  // weight: { type: Number },
  // dimensions: { type: String },
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
  specifications: [{
    key: String,
    value: String,
    isHighlight: { type: Boolean, default: false }
  }],
  variantGroups: [{
    name: String,
    options: [{
      label: String,
      priceDifference: Number,
      imageIndex: Number
    }]
  }],
  // warranty_info: { type: String },
  // return_policy: { type: String },
  // wholesaler_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketWholesaler', required: true, index: true },
  status: {
    type: String,
    enum: ['Draft', 'Live', 'Threshold reached', 'Paused', 'Sold out'],
    required: true,
    index: true,
  },
  // procurement_threshold: { type: Number, default: 20 },
  // est_delivery_days: { type: Number, default: 3 },
  // reportedStockQuantity: { type: Number, required: true, default: 0 },
  // --- END DEPRECATED FIELDS ---

  // --- NEW DIGITAL PRODUCT FIELDS ---
  productType: {
    type: String,
    enum: ['SaaS Tool', 'Web Template', 'Script/Automation', 'Source Code', 'UI Kit/Plugin']
  },
  licenseType: {
    type: String,
    enum: ['Personal', 'Commercial', 'Extended']
  },
  demoUrl: {
    type: String
  },
  documentationUrl: {
    type: String
  },
  techStack: [{
    type: String
  }],
  fileFormat: {
    type: String
  },
  fileSize: {
    type: String
  },
  version: {
    type: String
  },
  changelog: [{
    version: String,
    date: Date,
    notes: String
  }],
  downloadUrl: {
    type: String
  },
  screenshotGallery: [{
    type: String
  }],
  // --- END DIGITAL PRODUCT FIELDS ---
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isPopular: {
    type: Boolean,
    default: false,
  },
  isLatest: {
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
  }],
  // Reviews
  averageRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  reviews: [{
    user_id: String, // ID of the reviewer
    name: String,
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    verified: { type: Boolean, default: false }, // only verified buyers can leave a review
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
});

const MarketProduct = mongoose.models.MarketProduct || mongoose.model('MarketProduct', marketProductSchema);

export default MarketProduct;
