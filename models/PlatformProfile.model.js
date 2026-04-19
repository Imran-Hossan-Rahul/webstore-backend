// models/PlatformProfile.model.js
import mongoose, { Schema } from "mongoose";

const platformProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    industry: {
      type: String,
      enum: [
        "Technology",
        "Finance",
        "Healthcare",
        "Education",
        "E-commerce",
        "Marketing",
        "Real Estate",
        "Manufacturing",
        "Other",
      ],
    },
    hireHistory: [
      {
        creatorId: { type: Schema.Types.ObjectId, ref: "User" },
        projectTitle: String,
        hiredAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["active", "completed", "cancelled"],
          default: "active",
        },
      },
    ],
    savedCreators: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    preferences: {
      budgetRange: {
        min: Number,
        max: Number,
      },
      preferredSkills: [String],
      workTypePreference: {
        type: String,
        enum: ["solo", "team", "both"],
        default: "both",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance
platformProfileSchema.index({ userId: 1 });
platformProfileSchema.index({ "savedCreators": 1 });

const PlatformProfile =
  mongoose.models.PlatformProfile ||
  mongoose.model("PlatformProfile", platformProfileSchema, "platformprofiles");

export default PlatformProfile;
