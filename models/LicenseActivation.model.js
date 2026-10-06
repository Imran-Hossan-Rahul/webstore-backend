import mongoose from 'mongoose';

const licenseActivationSchema = new mongoose.Schema({
  license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketLicense',
    required: true,
    index: true,
  },
  domain: {
    type: String,
    required: true,
  },
  install_id: {
    type: String,
    required: true,
  },
  ip_address: {
    type: String,
  },
  version: {
    type: String, // Tracks what version of the software they are running
  },
  last_check_at: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'deactivated'],
    default: 'active',
  }
}, {
  timestamps: true,
});

// A domain can only be actively activated once per license
licenseActivationSchema.index({ license_id: 1, domain: 1 }, { unique: true });

const LicenseActivation = mongoose.models.LicenseActivation || mongoose.model('LicenseActivation', licenseActivationSchema);

export default LicenseActivation;
