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
      originalPriceDifference: Number,
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
    enum: ['Company Website', 'E-Commerce Website', 'SaaS Tool', 'Web Template', 'Script/Automation', 'UI Kit/Plugin', 'Custom Service'],
    default: 'Company Website'
  },
  licenseType: {
    type: String,
    enum: ['Personal', 'Commercial', 'Extended', 'Domain-Locked'],
    default: 'Domain-Locked'
  },
  demoUrl: { type: String },
  videoUrl: { type: String }, // YouTube/Vimeo demo
  documentationUrl: { type: String },
  repoLink: { type: String }, // Private github repo
  downloadUrl: { type: String }, // AWS S3 zip file
  techStack: [{ type: String }],
  fileFormat: { type: String },
  fileSize: { type: String },
  version: { type: String, default: "1.0.0" },
  changelog: [{
    version: String,
    date: { type: Date, default: Date.now },
    notes: String
  }],
  screenshotGallery: [{ type: String }],
  
  // IP Lock & Security Defaults
  requireIpLock: { type: Boolean, default: true },
  requireWatermark: { type: Boolean, default: true },

  // Tiered Pricing for display (e.g. Starter, Growth, Enterprise)
  tiers: [{
    id: String,
    name: String,
    price: Number,
    isPopular: Boolean,
    trustLine: String,
    bullets: [String]
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
