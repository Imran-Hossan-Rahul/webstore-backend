import mongoose from "mongoose";
import slugify from "slugify";
import { stripHtml } from "string-strip-html";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmanopqrstuvwxyz0123456789", 6);

const codexSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 200000,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    coverImage: {
      type: String,
      validate: {
        validator: (v) => {
          if (!v) return true;
          // Allow HTTPS URLs or base64 data URLs
          return /^https:\/\/.*\.(jpg|jpeg|png|webp|gif)$/i.test(v) || /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(v);
        },
        message: "Cover image must be a valid HTTPS URL or base64 image",
      },
    },
    cardShape: {
      type: String,
      enum: [
        "square-small", "square-medium", 
        "rectangle-horizontal", "rectangle-vertical",
        "tower", "skyscraper",
        "banner-wide", "featured",
        "poster", "cinematic"
      ],
      default: "square-medium",
    },
    tags: {
      type: [String],
      set: (tags) =>
        [...new Set(tags.map((t) => t.toLowerCase().trim()))].filter(
          (t) => t.length > 0
        ),
      default: [],
    },
    category: {
      type: String,
      trim: true,
      default: "uncategorized",
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    readTime: { type: String, default: "1 min read" },
    
    // New fields for enhanced codex cards
    subtitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    keyTakeaways: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10; // Max 10 takeaways
        },
        message: 'Maximum 10 key takeaways allowed'
      }
    },
    proTips: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10; // Max 10 pro tips
        },
        message: 'Maximum 10 pro tips allowed'
      }
    },
    
    // SEO Fields
    seoTitle: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    focusKeywords: {
      type: [String],
      default: [],
    },
    
    views: { type: Number, default: 0, min: 0 },
    hasReceived100ViewsToken: { type: Boolean, default: false },
    impressions: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sharesCount: { type: Number, default: 0, min: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* 🔥 Collision-safe Slug Generator */
codexSchema.pre("validate", async function (next) {
  if (!this.title) return next();
  const rawSlug = slugify(this.title, { lower: true, strict: true });
  let slugCandidate = rawSlug;

  while (
    await mongoose.models.Codex.exists({
      slug: slugCandidate,
      _id: { $ne: this._id },
    })
  ) {
    slugCandidate = `${rawSlug}-${nanoid()}`;
  }

  this.slug = slugCandidate;
  next();
});

/* 🔥 Clean HTML → Plain text excerpt */
codexSchema.pre("save", function () {
  if (!this.excerpt && this.content) {
    const plain = stripHtml(this.content).result;
    this.excerpt = plain.substring(0, 800) + "..";
  }
});

/* 🚀 Indexes for scale */
codexSchema.index({ slug: 1, isPublished: 1 });
codexSchema.index({ category: 1, isPublished: 1 });
codexSchema.index({ tags: 1 });
codexSchema.index({ createdAt: -1 });
codexSchema.index({ title: "text", content: "text", tags: "text", subtitle: "text" });

export default mongoose.models.Codex || mongoose.model("Codex", codexSchema);

