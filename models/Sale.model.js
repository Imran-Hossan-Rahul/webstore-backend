import mongoose from "mongoose";

const SaleSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Sale = mongoose.models.Sale || mongoose.model("Sale", SaleSchema);

export default Sale;
