import mongoose from "mongoose";

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true, trim: true },
      bn: { type: String, required: true, trim: true },
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      index: true 
    },
    description: {
      en: { type: String, trim: true },
      bn: { type: String, trim: true },
    },
    icon: { type: String }, // Cloudinary URL or Icon Class
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("BlogCategory", blogCategorySchema);
