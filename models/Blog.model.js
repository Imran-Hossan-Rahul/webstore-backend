import mongoose from "mongoose";

const blogTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true }, // Tiptap JSON or HTML
    excerpt: { type: String, required: true, trim: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
      index: true,
    },
    tags: [{ type: String, trim: true, index: true }],

    // Multilingual Content Support
    en: blogTranslationSchema,
    bn: blogTranslationSchema,
    
    // We can add a field to know which languages are currently available for this blog
    availableLanguages: [{ type: String, enum: ['en', 'bn'], default: ['en'] }],

    // Status and Visibility
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, index: true },

    // Media
    coverImage: { type: String }, // Cloudinary URL
    coverImageAlt: { type: String },

    // Analytics & Engagement (Updated via batch from Redis)
    views: { type: Number, default: 0 },
    readTime: { type: Number }, // Estimated read time in minutes
    likesCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for optimal querying of published blogs
blogSchema.index({ status: 1, publishedAt: -1 });

// Text index for basic search (Fallback before implementing Atlas Search / Elastic)
blogSchema.index(
  {
    "en.title": "text",
    "bn.title": "text",
    tags: "text",
  },
  {
    weights: {
      "en.title": 10,
      "bn.title": 10,
      tags: 5,
    },
    name: "BlogTextIndex",
  }
);

export default mongoose.model("Blog", blogSchema);
