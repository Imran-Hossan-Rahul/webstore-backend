import mongoose from "mongoose";

const jobSchema = mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String, 
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: "Development"
  },
  skills: [{
    type: String
  }],
  budget: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    type: { type: String, enum: ["fixed", "hourly"], default: "fixed" }
  },
  level: {
    type: String,
    enum: ["Entry", "Intermediate", "Expert"],
    default: "Intermediate"
  },
  location: {
    type: String,
    default: "Remote" // Remote, On-site, Hybrid
  },
  status: {
    type: String,
    enum: ["open", "closed", "hired"],
    default: "open"
  },
  applicants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "pending" }, // pending, rejected, shortlisted
    appliedAt: { type: Date, default: Date.now }
  }],
  deadline: {
    type: Date
  }
}, {
  timestamps: true
});

const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);

export default Job;
