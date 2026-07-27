import mongoose from 'mongoose';

const marketConfigSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'MARKET_CONFIG',
    unique: true
  },
  flashDeals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProduct'
  }],
  trendingNow: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProduct'
  }],
  todaysOffer: {
    title: { type: String, default: "Get 20% OFF\non Audio Gear" },
    code: { type: String, default: "AUDIO20" },
    link: { type: String, default: "#" },
    isActive: { type: Boolean, default: true },
    discountPercentage: { type: Number, default: 20 },
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MarketProduct' }]
  },
  brandSpotlight: {
    brandName: { type: String, default: "Brand Spotlight" },
    subtitle: { type: String, default: "GEEOO Premium Gear" },
    logoUrl: { type: String, default: "/logo.png" },
    bgUrl: { type: String, default: "/geeoo-banner.jpg" },
    link: { type: String, default: "#" },
    isActive: { type: Boolean, default: true }
  }
}, { timestamps: true });

const MarketConfig = mongoose.model('MarketConfig', marketConfigSchema);

export default MarketConfig;
