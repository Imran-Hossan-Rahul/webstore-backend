import mongoose from "mongoose";

const tokenTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  xpAmount: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    enum: ["reward", "spend", "transfer", "refund"],
    required: true
  },
  source: {
    type: String, // e.g., "challenge_complete", "daily_checkin", "admin_bonus"
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId, // ID of the challenge, job, etc.
    index: true
  },
  description: String,
  isVerifiedExperience: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed"
  },
  metadata: {
    ip: String,
    userAgent: String,
    previousBalance: Number,
    newBalance: Number
  }
}, { timestamps: true });

// Ensure audit trail integrity
tokenTransactionSchema.pre("save", function(next) {
  // Logic to prevent tampering could go here (e.g. signature check)
  next();
});

const TokenTransaction = mongoose.models.TokenTransaction || mongoose.model("TokenTransaction", tokenTransactionSchema);
export default TokenTransaction;
