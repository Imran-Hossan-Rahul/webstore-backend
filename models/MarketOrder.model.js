import mongoose from 'mongoose';

const marketOrderSchema = new mongoose.Schema({
  user_id: {
    type: String, // Nullable for guest
  },
  phone: {
    type: String, // Essential for guest checkout
  },
  email: {
    type: String, // Essential for digital delivery
  },
  customer_name: {
    type: String, // Essential for digital delivery
  },
  address: {
    type: Object, // division, district, upazila (now optional)
  },
  custom_details: {
    type: Object, // budget, timeline, projectDetails for custom briefs
  },
  status: {
    type: String,
    enum: ['Pending Verification', 'Payment Failed', 'Confirmed', 'In Collaboration', 'Provisioning', 'Active', 'Delivered', 'Suspended', 'Cancelled'],
    default: 'Pending Verification',
    required: true,
    index: true,
  },
  projectPhase: {
    type: String,
    enum: ['Discovery', 'Design', 'Development', 'Testing', 'Launch', 'N/A'],
    default: 'N/A' // Used for Custom Services
  },
  deliveryDomain: {
    type: String, // The domain the license will be bound to
  },
  githubHandle: {
    type: String, // For auto-granting repo access
  },
  collaborationRoomId: {
    type: String, // Reference to the dedicated chat/file room
  },
  // DEPRECATED PHYSICAL FIELDS
  courier_name: { type: String },
  tracking_id: { type: String },
  delivery_charge: { type: Number, default: 0 },
  // --------------------------
  discount_amount: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  source_channel: { type: String },
  payment_method: { type: String, default: 'Stripe' },
  payment_number: { type: String }, // Used for manual bKash/Nagad
  payment_trx_id: { type: String }, // TxID for manual or automated
  payment_status: {
    type: String,
    enum: ['Pending', 'Verified', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  payment_due: { type: Number, default: 0 },
  confirmed_at: { type: Date }
}, {
  timestamps: true,
});

marketOrderSchema.virtual('items', {
  ref: 'MarketOrderItem',
  localField: '_id',
  foreignField: 'order_id',
});

marketOrderSchema.set('toObject', { virtuals: true });
marketOrderSchema.set('toJSON', { virtuals: true });

const MarketOrder = mongoose.models.MarketOrder || mongoose.model('MarketOrder', marketOrderSchema);

export default MarketOrder;

