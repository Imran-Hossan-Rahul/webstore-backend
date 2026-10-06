import mongoose from 'mongoose';

const abuseFlagSchema = new mongoose.Schema({
  license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketLicense',
    required: true,
    index: true,
  },
  flag_type: {
    type: String,
    enum: ['domain_limit_exceeded', 'ip_velocity', 'failed_verifications', 'download_spike'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  details: {
    type: Object, // Store JSON details like offending IPs, domains, timestamps
  },
  status: {
    type: String,
    enum: ['open', 'resolved', 'ignored'],
    default: 'open',
  },
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin who resolved it
  },
  resolved_at: {
    type: Date,
  }
}, {
  timestamps: true,
});

const AbuseFlag = mongoose.models.AbuseFlag || mongoose.model('AbuseFlag', abuseFlagSchema);

export default AbuseFlag;
