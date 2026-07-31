import mongoose from "mongoose";

const PredictiveAnalyticsSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const PredictiveAnalytics = mongoose.models.PredictiveAnalytics || mongoose.model("PredictiveAnalytics", PredictiveAnalyticsSchema);

export default PredictiveAnalytics;
