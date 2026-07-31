import mongoose from 'mongoose';

const marketBannerSchema = new mongoose.Schema({
  titleTop: {
    type: String,
    required: true,
    trim: true,
  },
  titleBottom: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

const MarketBanner = mongoose.models.MarketBanner || mongoose.model('MarketBanner', marketBannerSchema);
export default MarketBanner;
