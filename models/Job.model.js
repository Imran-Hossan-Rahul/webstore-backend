import mongoose from "mongoose";

/**
 * Hiring Pipeline Stages (in order):
 *  1. proposal_sent      → Talent submitted a proposal
 *  2. under_review       → patron is reviewing the proposal
 *  3. shortlisted        → patron shortlisted the talent
 *  4. interview          → Interview / call scheduled
 *  5. offer_sent         → Offer/contract terms extended
 *  6. hired              → Officially hired, contract created
 *  7. rejected           → Not selected at any stage
 */
const stageHistorySchema = new mongoose.Schema({
  stage: { type: String },
  changedAt: { type: Date, default: Date.now },
  note: { type: String, default: "" }
}, { _id: false });

const applicantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" }, // Linked formal contract

  // Current pipeline stage
  stage: {
    type: String,
    enum: ["proposal_sent", "under_review", "shortlisted", "interview", "offer_sent", "hired", "paused", "rejected", "trash"],
    default: "proposal_sent"
  },

  // Detailed proposal from talent
  proposal: {
    coverLetter:   { type: String, default: "" },
    expectedRate:  { type: Number },             // Amount talent wants
    rateType:      { type: String, enum: ["fixed", "hourly"], default: "fixed" },
    availability:  { type: String, default: "" }, // e.g. "2 weeks notice" or "Immediately"
    estimatedDays: { type: Number },              // Estimated days to complete
    portfolioLinks: [{
      url:   { type: String },
      label: { type: String }
    }],           // URLs to relevant past work
    // Formal Offer Data (Drafted by Patron)
    offer: {
      scope:          { type: String },
      milestones: [{ 
        title: String, 
        amount: Number, 
        dueDate: Date,
        isInitial: { type: Boolean, default: false },
        isAutoFunded: { type: Boolean, default: false },
        isAutoBalance: { type: Boolean, default: false }
      }],
      legalTerms:     { nda: { type: Boolean, default: false }, ipOwnership: { type: String, default: "patron" } },
      timeline:       { startDate: Date, endDate: Date },
      agreedBudget:   { type: Number },
      budgetType:     { type: String, enum: ["fixed", "hourly"] },
      draftedAt:      { type: Date, default: Date.now }
    }
  },

  // Full stage trail so talent can see their journey
  stageHistory: [stageHistorySchema],

  // patron notes (internal, not shown to talent)
  patronNote: { type: String, default: "" },

  appliedAt: { type: Date, default: Date.now }
});

const jobSchema = mongoose.Schema({
  patron: {
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
  skills: [{ type: String }],
  budget: {
    min:      { type: Number, required: true },
    max:      { type: Number, required: true },
    currency: { type: String, default: "TKNS" },
    type:     { type: String, enum: ["fixed", "hourly"], default: "fixed" }
  },
  level: {
    type: String,
    enum: ["Entry", "Intermediate", "Expert"],
    default: "Intermediate"
  },
  location: {
    type: String,
    default: "Remote"
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "closed"],  // removed "hired" — job stays open for multi-hire
    default: "open"
  },
  applicants: [applicantSchema],
  deadline: { type: Date }
}, {
  timestamps: true
});

// Full-text search index for high-performance Job Board
jobSchema.index(
  { 
    title: "text", 
    description: "text", 
    skills: "text", 
    category: "text" 
  },
  { 
    name: "job_search_index",
    weights: {
      title: 10,
      skills: 5,
      category: 3,
      description: 1
    }
  }
);

// ✅ OPTIMIZATION: Added compound indexes for common query patterns
jobSchema.index({ patron: 1, createdAt: -1 });          // patron's own jobs
jobSchema.index({ status: 1, createdAt: -1 });          // open/active job listings
jobSchema.index({ status: 1, category: 1, createdAt: -1 }); // filtered job board
jobSchema.index({ deadline: 1 }, { sparse: true });     // deadline-approaching filter

const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);

export default Job;

