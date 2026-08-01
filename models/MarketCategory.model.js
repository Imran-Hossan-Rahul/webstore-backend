import mongoose from 'mongoose';

const marketCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
  },
  isSubcategory: {
    type: Boolean,
    default: false,
  },
  maxWeightPerPiece: {
    type: Number,
    default: 0,
    description: 'Maximum weight per piece in grams for automated delivery costing'
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketCategory',
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

const MarketCategory = mongoose.models.MarketCategory || mongoose.model('MarketCategory', marketCategorySchema);

export default MarketCategory;
