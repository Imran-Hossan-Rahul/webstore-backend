import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },
    patron: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    craftsman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    budgetType: {
      type: String,
      enum: ["fixed", "hourly"],
      required: true
    },
    agreedBudget: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "disputed"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["unfunded", "partially_funded", "fully_funded"],
      default: "unfunded"
    },
    escrowBalance: {
      type: Number,
      default: 0
    },
    platformFeeRate: {
      type: Number,
      default: 10 // 10% commission for the platform owner
    },
    milestones: [{
      title: String,
      amount: String,
      dueDate: Date,
      status: {
        type: String,
        enum: ["pending", "funded", "submitted", "approved", "holding", "paid", "disputed"],
        default: "pending"
      },
      isFunded: {
        type: Boolean,
        default: false
      },
      amountFunded: {
        type: Number,
        default: 0
      },
      submissions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        title: String,
        tagline: String,
        fullBrief: String,
        githubLink: String,
        accessibleLink: String,
        liveUrl: String,
        videoLink: String,
        techStack: [String],
        screenshots: [String],
        description: String,
        resources: [{
          title: String,
          url: String,
          altText: String,
          type: { type: String, default: 'link' }
        }],
        attachments: [{
          name: String,
          url: String,
          size: Number,
          type: { type: String }
        }],
        submittedAt: { type: Date, default: Date.now }
      }],
      // 3-Day Hold Mechanism
      holdStatus: {
        type: String,
        enum: ["none", "holding", "released", "disputed"],
        default: "none"
      },
      releaseScheduledAt: { type: Date },  // When the 3-day hold expires
      releasedAt: { type: Date },          // When funds were actually released
      approvedAt: { type: Date },          // When patron approved the work
      isAutoFunded: {
        type: Boolean,
        default: false
      },
      isInitial: {
        type: Boolean,
        default: false
      },
      isAutoBalance: {
        type: Boolean,
        default: false
      }
    }],
    craftsmanAccepted: {
      type: Boolean,
      default: false
    },
    patronAccepted: {
      type: Boolean,
      default: false
    },
    requirements: String,
    legalTermsAccepted: {
      type: Boolean,
      default: false
    },
    isRevised: {
      type: Boolean,
      default: false
    },
    revisionCount: {
      type: Number,
      default: 0
    },
    lastActionAt: {
      type: Date,
      default: Date.now
    },
    activities: [{
      type: { type: String }, // 'created', 'accepted', 'funded', 'submitted', 'approved', 'paid', 'disputed'
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      message: String,
      timestamp: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

const Contract = mongoose.model("Contract", contractSchema);
export default Contract;
