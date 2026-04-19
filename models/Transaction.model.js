import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    // User who purchased
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Template purchased
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ButtonTemplate",
      required: true,
      index: true,
    },
    
    // Template creator (for payouts)
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    
    // Platform commission (percentage)
    platformCommission: {
      type: Number,
      default: 30, // 30% platform, 70% creator
      min: 0,
      max: 100,
    },
    
    // Calculated amounts
    platformAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    creatorAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Payment method
    paymentMethod: {
      type: String,
      enum: ["stripe", "payoneer", "manual", "sslcommerz", "aamarpay", "bkash", "nagad", "rocket", "bank_transfer"],
      default: "stripe",
      index: true,
    },
    
    // Stripe payment details (if using Stripe)
    stripePaymentIntentId: {
      type: String,
      index: true,
    },
    
    stripeSessionId: {
      type: String,
      index: true,
    },
    
    stripeChargeId: {
      type: String,
    },
    
    // Payoneer payment details (if using Payoneer)
    payoneerPaymentLink: {
      type: String,
    },
    
    payoneerTransactionId: {
      type: String,
    },
    
    // Manual payment details (bKash, Nagad, Rocket, Bank Transfer)
    manualPaymentDetails: {
      method: String, // "bkash", "nagad", "rocket", "bank_transfer"
      transactionId: String,
      phoneNumber: String, // For mobile banking
      bankName: String, // For bank transfer
      accountNumber: String, // For bank transfer
      referenceNumber: String,
      screenshot: String, // URL to payment proof screenshot
      notes: String,
    },
    
    // SSLCommerz/Aamarpay details (if using Bangladesh gateways)
    gatewayTransactionId: {
      type: String,
    },
    
    gatewaySessionId: {
      type: String,
    },
    
    // Payment status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "verifying"],
      default: "pending",
      index: true,
    },
    
    // Manual verification (for manual payments)
    requiresVerification: {
      type: Boolean,
      default: false,
    },
    
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    verifiedAt: {
      type: Date,
    },
    
    // Payout status for creator
    payoutStatus: {
      type: String,
      enum: ["pending", "processing", "paid", "failed"],
      default: "pending",
      index: true,
    },
    
    // Payout reference (when paid to creator)
    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payout",
    },
    
    // Metadata
    metadata: {
      type: Map,
      of: String,
    },
    
    // Refund information
    refundedAt: {
      type: Date,
    },
    
    refundAmount: {
      type: Number,
      default: 0,
    },
    
    refundReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
transactionSchema.index({ buyer: 1, createdAt: -1 });
transactionSchema.index({ creator: 1, createdAt: -1 });
transactionSchema.index({ template: 1, createdAt: -1 });
transactionSchema.index({ status: 1, payoutStatus: 1 });
transactionSchema.index({ stripePaymentIntentId: 1 });
transactionSchema.index({ stripeSessionId: 1 });

// Virtual for formatted amount
transactionSchema.virtual("formattedAmount").get(function () {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

// Method to calculate amounts
transactionSchema.methods.calculateAmounts = function () {
  const commissionRate = this.platformCommission / 100;
  this.platformAmount = Math.round(this.amount * commissionRate * 100) / 100;
  this.creatorAmount = Math.round((this.amount - this.platformAmount) * 100) / 100;
};

// Pre-save hook to calculate amounts
transactionSchema.pre("save", function (next) {
  if (this.isModified("amount") || this.isModified("platformCommission")) {
    this.calculateAmounts();
  }
  next();
});

// Prevent model overwrite
const Transaction =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema, "transactions");

export default Transaction;

