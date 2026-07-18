import mongoose from 'mongoose';

const marketProcurementRunSchema = new mongoose.Schema({
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketWholesaler',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  total_cost: {
    type: Number,
    required: true,
  },
  payment_status: {
    type: String,
    enum: ['Pending', 'Paid'],
    required: true,
  }
}, {
  timestamps: true,
});

marketProcurementRunSchema.virtual('orderItems', {
  ref: 'MarketOrderItem',
  localField: '_id',
  foreignField: 'procurement_run_id',
});

marketProcurementRunSchema.set('toObject', { virtuals: true });
marketProcurementRunSchema.set('toJSON', { virtuals: true });

const MarketProcurementRun = mongoose.models.MarketProcurementRun || mongoose.model('MarketProcurementRun', marketProcurementRunSchema);

export default MarketProcurementRun;
