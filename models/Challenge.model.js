import mongoose from "mongoose";

const challengeSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ["upcoming", "active", "completed"],
    default: "active"
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  prize: {
    type: String, // e.g. "$500 + Badge"
    required: true
  },
  prizeDetails: {
    first: String,
    second: String,
    third: String
  },
  rules: [{
    type: String
  }],
  type: {
    type: String,
    enum: ["design", "code", "content"],
    default: "design"
  },
  submissions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    projectLink: String,
    description: String,
    submittedAt: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 }
  }],
  winners: [{
    rank: { type: Number }, // 1, 2, 3
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }]
}, {
  timestamps: true
});

const Challenge = mongoose.models.Challenge || mongoose.model("Challenge", challengeSchema);

export default Challenge;
