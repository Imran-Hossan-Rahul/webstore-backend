import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contract"
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User" // Can be null if it's a deposit to platform
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: "TKNS"
  },
  type: {
    type: String,
    enum: ["deposit", "escrow_release", "commission", "payout", "refund"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "reversed"],
    default: "pending"
  },
  paymentGateway: {
    type: String,
    enum: ["token_internal", "crypto", "manual"],
    default: "token_internal"
  },
  gatewayTransactionId: String,
  metadata: Object,
  feeAmount: Number // Platform commission for this specific transaction
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
export default Transaction;
