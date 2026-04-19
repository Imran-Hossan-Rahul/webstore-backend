// models/CreatorProfile.model.js
import mongoose, { Schema } from "mongoose";

const creatorProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },
    profilePicture: {
      type: String,
      default: "",
    },
    coverPicture: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 20; // Max 20 skills
        },
        message: "You can add up to 20 skills only",
      },
    },
    workType: {
      type: String,
      enum: ["solo", "team"],
      default: "solo",
    },
    portfolio: [
      {
        title: String,
        url: String,
        description: String,
        thumbnail: String,
      },
    ],
    socialLinks: {
      github: String,
      linkedin: String,
      twitter: String,
      website: String,
      behance: String,
      dribbble: String,
    },
    // Creator-specific analytics
    totalViews: {
      type: Number,
      default: 0,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },
    totalBlogs: {
      type: Number,
      default: 0,
    },
    totalTemplates: {
      type: Number,
      default: 0,
    },
    // Creator status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    // Creator level/badge
    level: {
      type: String,
      enum: ["beginner", "intermediate", "expert", "pro"],
      default: "beginner",
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Indexes for performance
creatorProfileSchema.index({ userId: 1 });
creatorProfileSchema.index({ skills: 1 });
creatorProfileSchema.index({ isActive: 1 });
creatorProfileSchema.index({ level: 1 });

// Virtual for full profile URL
creatorProfileSchema.virtual("profileUrl").get(function () {
  return `/creator/${this.userId}`;
});

const CreatorProfile =
  mongoose.models.CreatorProfile ||
  mongoose.model("CreatorProfile", creatorProfileSchema, "creatorprofiles");

export default CreatorProfile;
