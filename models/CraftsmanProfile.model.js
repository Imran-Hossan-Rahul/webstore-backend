import mongoose, { Schema } from "mongoose";

const craftsmanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    bio: { type: String, default: "", maxlength: 500 },
    skills: { type: [String], default: [] },
    workType: { type: String, enum: ["solo", "team"], default: "solo" },
    profilePicture: { type: String, default: "" },
    coverPicture: { type: String, default: "" },
    portfolio: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        description: { type: String, default: "" },
        thumbnail: { type: String, default: "" },
      },
    ],
    socialLinks: {
      github: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
      behance: { type: String, default: "" },
      dribbble: { type: String, default: "" },
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

craftsmanSchema.index({ displayName: "text", skills: "text", bio: "text" });

const CraftsmanProfile =
  mongoose.models.CraftsmanProfile ||
  mongoose.model("CraftsmanProfile", craftsmanSchema, "craftsmanprofiles");

export default CraftsmanProfile;
