// models/Sale.js
import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    // 🗓️ Date of the sale (defaults to today)
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // 💰 Total sales amount for the day
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // 📦 Number of products sold that day
    productCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 👤 Who created the record
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// ⚙️ Add an index for faster date queries
saleSchema.index({ date: 1 });

// 🧩 Data validation before saving
saleSchema.pre("save", function (next) {
  if (this.amount === 0 && this.productCount > 0) {
    return next(
      new Error("Product count cannot be greater than 0 if amount is 0")
    );
  }
  next();
});

// ✅ Prevent model overwrite error in development (Next.js friendly)
const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);

export default Sale;
