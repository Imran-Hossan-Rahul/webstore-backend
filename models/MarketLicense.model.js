import mongoose from 'mongoose';

const marketLicenseSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketOrder',
    required: true,
    index: true,
  },
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProduct',
    required: true,
  },
  license_key_hash: {
    type: String,
    required: true,
    unique: true, // We store the hash of the XXXX-XXXX-XXXX-XXXX key
  },
  tier: {
    type: String,
    enum: ['Personal', 'Commercial', 'Extended', 'Domain-Locked'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'revoked'],
    default: 'active',
  },
  authorized_domains: [{
    type: String, // e.g., 'clientdomain.com'
  }],
  authorized_ips: [{
    type: String, // e.g., '192.168.1.1'
  }],
  max_activations: {
    type: Number,
    required: true,
  },
  support_expires_at: {
    type: Date,
  },
  updates_expires_at: {
    type: Date,
  },
  parent_license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketLicense', // For reseller sub-licenses
  }
}, {
  timestamps: true,
});

const MarketLicense = mongoose.models.MarketLicense || mongoose.model('MarketLicense', marketLicenseSchema);

export default MarketLicense;
