import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    // Craftsman receiving payout
    craftsman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Total amount to payout
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "TKNS",
      uppercase: true,
    },

    // Transactions included in this payout
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],

    // Payout method
    payoutMethod: {
      type: String,
      enum: ["internal_wallet"],
      default: "internal_wallet",
    },

    // Bank details (if bank transfer)
    bankDetails: {
      accountNumber: String,
      bankName: String,
      swiftCode: String,
      accountHolderName: String,
      country: String,
    },

    // Payout status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    // Processing information
    processedAt: {
      type: Date,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // External payout reference (Payoneer transaction ID, etc.)
    externalReference: {
      type: String,
    },

    // Failure reason
    failureReason: {
      type: String,
    },

    // Notes
    notes: {
      type: String,
    },

    // Minimum payout threshold (for future use)
    minimumThreshold: {
      type: Number,
      default: 50, // $50 minimum
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
payoutSchema.index({ craftsman: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

// Virtual for transaction count
payoutSchema.virtual("transactionCount").get(function () {
  return this.transactions?.length || 0;
});

// Method to check if payout meets minimum threshold
payoutSchema.methods.meetsMinimumThreshold = function () {
  return this.amount >= this.minimumThreshold;
};

// Prevent model overwrite
const Payout =
  mongoose.models.Payout || mongoose.model("Payout", payoutSchema, "payouts");

export default Payout;
