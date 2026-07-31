import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Payout = mongoose.models.Payout || mongoose.model("Payout", PayoutSchema);

export default Payout;
