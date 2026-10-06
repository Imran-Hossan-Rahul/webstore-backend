import mongoose from 'mongoose';

const buildFingerprintSchema = new mongoose.Schema({
  license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketLicense',
    required: true,
    index: true,
  },
  canary_token: {
    type: String, // E.g., a UUID or unique string injected into the code
    required: true,
    unique: true,
  },
  watermark_seed: {
    type: String, // The seed used to generate structural watermarks
  },
  injected_at: {
    type: Date,
    default: Date.now,
  },
  build_status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  }
}, {
  timestamps: true,
});

const BuildFingerprint = mongoose.models.BuildFingerprint || mongoose.model('BuildFingerprint', buildFingerprintSchema);

export default BuildFingerprint;
