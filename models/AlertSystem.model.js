// models/AlertSystem.model.js
import mongoose from 'mongoose';

const alertSystemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['threshold', 'anomaly', 'trend', 'conversion', 'churn', 'performance', 'security'],
    required: true
  },
  
  config: {
    metric: String,
    condition: { type: String, enum: ['greater_than', 'less_than', 'equals', 'change_by', 'anomaly_detected'] },
    threshold: Number,
    timeWindow: Number,
    comparison: String
  },
  
  notifications: {
    email: { enabled: Boolean, recipients: [String] },
    slack: { enabled: Boolean, webhook: String, channel: String },
    webhook: { enabled: Boolean, url: String, method: String },
    inApp: { enabled: Boolean, priority: String }
  },
  
  status: { type: String, enum: ['active', 'paused', 'disabled'], default: 'active' },
  lastTriggered: Date,
  triggerCount: { type: Number, default: 0 },
  
  history: [{
    triggeredAt: Date,
    value: Number,
    threshold: Number,
    message: String,
    acknowledged: { type: Boolean, default: false }
  }],
  
  filters: {
    pages: [String],
    userSegments: [String],
    devices: [String],
    countries: [String]
  },
  
  cooldown: { type: Number, default: 60 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

alertSystemSchema.index({ status: 1, type: 1 });

alertSystemSchema.methods.trigger = async function(value, message) {
  this.lastTriggered = new Date();
  this.triggerCount++;
  this.history.push({ triggeredAt: new Date(), value, threshold: this.config.threshold, message });
  await this.save();
  return this.sendNotifications(message, value);
};

alertSystemSchema.methods.sendNotifications = async function(message, value) {
  const notifications = [];
  if (this.notifications.email?.enabled) notifications.push(this.sendEmail(message, value));
  if (this.notifications.slack?.enabled) notifications.push(this.sendSlack(message, value));
  if (this.notifications.webhook?.enabled) notifications.push(this.sendWebhook(message, value));
  return Promise.all(notifications);
};

alertSystemSchema.methods.sendEmail = async function(message) {
  console.log(`Email alert: ${message}`);
};

alertSystemSchema.methods.sendSlack = async function(message) {
  console.log(`Slack alert: ${message}`);
};

alertSystemSchema.methods.sendWebhook = async function(message) {
  console.log(`Webhook alert: ${message}`);
};

const AlertSystem = mongoose.model('AlertSystem', alertSystemSchema);
export default AlertSystem;
