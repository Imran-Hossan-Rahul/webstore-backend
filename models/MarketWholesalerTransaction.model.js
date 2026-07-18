import mongoose from 'mongoose';

const marketWholesalerTransactionSchema = new mongoose.Schema({
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketWholesaler',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['owed', 'paid'],
    required: true,
  },
  linked_run_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarketProcurementRun',
  },
  date: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

const MarketWholesalerTransaction = mongoose.models.MarketWholesalerTransaction || mongoose.model('MarketWholesalerTransaction', marketWholesalerTransactionSchema);

export default MarketWholesalerTransaction;
