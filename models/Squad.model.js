import mongoose from "mongoose";

const squadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["member", "admin"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        }
      }
    ],
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalXP: {
      type: Number,
      default: 0,
    },
    skills: [{
      type: String,
      trim: true
    }],
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Squad", squadSchema);
