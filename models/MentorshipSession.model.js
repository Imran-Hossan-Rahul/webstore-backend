import mongoose from "mongoose";

const mentorshipSessionSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "completed", "cancelled"],
      default: "pending",
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    costTokens: {
      type: Number,
      required: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    meetingLink: {
      type: String,
      trim: true,
    }
  },
  { timestamps: true }
);

export default mongoose.model("MentorshipSession", mentorshipSessionSchema);
