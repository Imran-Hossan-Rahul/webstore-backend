import mongoose from 'mongoose';

const marketWholesalerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  exactLocation: {
    type: String,
    required: true,
  },
  website: {
    type: String,
  },
  nidOrTradeLicense: {
    type: String,
  },
  productCategories: {
    type: String,
    required: true,
  },

  shopHours: {
    type: String,
    required: true,
  },
  googleMapsLink: {
    type: String,
    required: true,
  },
  paymentMethods: {
    type: String,
    required: true,
  },
  paymentDetails: {
    type: String,
  },
  shopPhotos: {
    type: String,
  },
  idPhotos: {
    type: String,
  },
  supplierCategory: {
    type: String,
    enum: ['Manufacturer', 'Distributor', 'Wholesaler', 'Other'],
    default: 'Wholesaler',
  },
  minOrderQuantity: {
    type: Number,
    default: 1,
  },
  contact: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
  },
  payment_arrangement: {
    type: String,
    enum: ['pay_after_cod', 'pay_on_collection'],
    required: true,
    index: true,
  },
  running_balance: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

// To easily return a virtual count of products if needed later
marketWholesalerSchema.virtual('products', {
  ref: 'MarketProduct',
  localField: '_id',
  foreignField: 'wholesaler_id',
});

marketWholesalerSchema.virtual('runs', {
  ref: 'MarketProcurementRun',
  localField: '_id',
  foreignField: 'wholesaler_id',
});

marketWholesalerSchema.set('toObject', { virtuals: true });
marketWholesalerSchema.set('toJSON', { virtuals: true });

const MarketWholesaler = mongoose.models.MarketWholesaler || mongoose.model('MarketWholesaler', marketWholesalerSchema);

export default MarketWholesaler;
