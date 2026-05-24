import mongoose from "mongoose";

const challengeSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true
  },
  coverImage: {
    type: String
  },
  category: {
    type: String
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert']
  },
  tags: [{ type: String }],
  prize: {
    type: String,
    required: true
  },
  prizePool: {
    type: Number, // Total tokens distributed by platform
    required: true,
    default: 0
  },
  rewardDistribution: [{
    rank: Number, // 1, 2, 3... 10
    amount: Number // tokens for this rank
  }],
  payoutStatus: {
    type: String,
    enum: ["pending", "processing", "distributed"],
    default: "pending"
  },
  status: {
    type: String,
    enum: ["draft", "upcoming", "active", "completed", "cancelled", "published", "registration_open", "submissions_open", "in_review"],
    default: "active"
  },
  phases: {
    registrationStart: { type: Date },
    registrationEnd: { type: Date },
    submissionStart: { type: Date },
    submissionEnd: { type: Date },
    judgingStart: { type: Date },
    judgingEnd: { type: Date },
    winnerAnnouncement: { type: Date }
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  brandColor: { type: String, default: "#4f46e5" },
  sponsorLogos: [{ type: String }],
  faq: [{ question: String, answer: String }],
  judges: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  prizeDetails: {
    first: String,
    second: String,
    third: String
  },
  rules: [{
    type: String
  }],
  milestones: [{
    title: { type: String, required: true },
    date: { type: Date, required: true },
    description: String,
    status: { type: String, enum: ['upcoming', 'active', 'completed'], default: 'upcoming' }
  }],
  judgingCriteria: [{
    criterion: { type: String, required: true },
    weight: { type: Number, required: true }, // e.g. 40 for 40%
    description: String
  }],
  resources: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['link', 'file', 'video', 'doc'], default: 'link' }
  }],
  submissionRequirements: {
    requireVideo: { type: Boolean, default: false },
    requireFile: { type: Boolean, default: false },
    requireRepo: { type: Boolean, default: true }
  },
  teamConfiguration: {
    participationType: { type: String, enum: ['Solo', 'Team', 'Both'], default: 'Solo' },
    minTeamSize: { type: Number, default: 1 },
    maxTeamSize: { type: Number, default: 1 }
  },
  techStack: {
    allowed: [{ type: String }],
    avoid: [{ type: String }]
  },
  visibility: {
    isPublic: { type: Boolean, default: true },
    allowedLevels: [{ type: Number }],
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  requirements: [{
    type: String
  }],
  type: {
    type: String,
    enum: ["design", "code", "content"],
    default: "design"
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    participationType: { type: String, enum: ["Solo", "Team"], default: "Solo" },
    role: String,
    experience: String,
    portfolioLink: String,
    intent: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  submissions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    evaluationScores: [{
        judge: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        scores: [{
            criterion: String,
            score: Number
        }],
        totalScore: Number,
        feedback: String
    }],
    tagline: String,
    title: String,
    fullBrief: { type: String },           // Full devlog description/brief
    // Links
    githubLink: { type: String },          // GitHub repo link — primary required
    accessibleLink: { type: String },      // Full devlog access (Drive, zip URL, etc.)
    liveUrl: { type: String },             // Live deployment URL
    devlogLink: String,                   // backward compat
    repoLink: String,                      // backward compat
    videoLink: String,
    // Tech & media
    techStack: [String],
    screenshots: [String],
    description: String,
    challengesFaced: String,
    futurePlans: String,
    // Resources: links & files each with optional alt text
    resources: [{
        title: { type: String },
        url: { type: String },
        altText: { type: String },
        type: { type: String, enum: ['link', 'file', 'video', 'doc', 'github'], default: 'link' }
    }],
    submittedAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  }],
  winners: [{
    rank: { type: Number },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge" }, // Correction: should be ref to self or just store sub id
    payoutReleased: { type: Boolean, default: false }
  }],
  craftsman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  updates: [{
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  lastPhaseUpdatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Full-text search index for Challenge
challengeSchema.index(
  {
    title: "text",
    description: "text",
    tags: "text",
    category: "text",
    difficulty: "text"
  },
  {
    name: "challenge_search_index",
    weights: {
      title: 10,
      tags: 5,
      category: 3,
      description: 1,
      difficulty: 1
    }
  }
);

const Challenge = mongoose.models.Challenge || mongoose.model("Challenge", challengeSchema);

export default Challenge;

