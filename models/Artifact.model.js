import mongoose from "mongoose";
const { Schema } = mongoose;

const artifactSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: false },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    slug: { type: String, trim: true, lowercase: true, index: true },

    sourceType: {
      type: String,
      enum: ["codepen", "user", "upload"],
      default: "user",
    },
    codepenUrl: { type: String, trim: true },
    slugHash: { type: String, trim: true, index: true },
    embedUrl: { type: String, trim: true },
    thumbnailSource: { type: String, trim: true },
    thumbnailGeneratedAt: { type: Date },

    description: { type: String, required: true, trim: true, maxlength: 2000 },
    tags: [{ type: String, trim: true, lowercase: true }],
    tech: [{ type: String, trim: true }],
    category: {
      type: String,
      required: true,
      enum: [
        "UI",
        "Site Artifacts",
        "eCommerce",
        "Admin Dashboard",
        "Animation",
        "Codexging",
        "Marketing",
        "Mobile Ui",
        "Components",
        "Other",
      ],
      default: "Other",
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
    impressionsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    priceType: { type: String, enum: ["free", "paid"], default: "free" },
    price: { type: Number, default: 0, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    currency: { type: String, default: "TKNS", uppercase: true },
    purchasedBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],

    githubLink: { type: String, trim: true },
    liveLink: { type: String, trim: true },
    previewFile: { type: String, required: true, trim: true },
    fileUrl: { type: String, trim: true },
    devlogFile: { type: String, required: true, trim: true },
    fileSize: { type: Number, min: 0 },
    fileType: { type: String, trim: true, lowercase: true },

    likeCount: { type: Number, default: 0 },
    likedBy: [{ type: String }], // userId OR visitorId

    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    commentsCount: { type: Number, default: 0 },

    salesCount: { type: Number, default: 0 },
    downloadsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (v) => Math.round(v * 10) / 10,
    },
    ratingCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "pending",
    },
    verifiedSeller: { type: Boolean, default: false },

    // Security scan result
    scanResult: {
      scanned: { type: Boolean, default: false },
      passed: { type: Boolean, default: false },
      errors: [{ type: String }],
      warnings: [{ type: String }],
      scannedAt: { type: Date },
    },

    versions: [
      {
        version: { type: String, trim: true },
        changelog: { type: String, trim: true },
        previewFile: { type: String },
        devlogFile: { type: String },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    currentVersion: { type: String, default: "v1.0.0" },

    isActive: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    editorsChoice: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 },

    // SEO Fields
    seoTitle: { type: String, trim: true, maxlength: 60 },
    seoDescription: { type: String, trim: true, maxlength: 160 },
    focusKeywords: { type: [String], default: [] },
    
    // Audit logs and history are now moved to Interaction and AuditLog models
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.auditLogs;
        return ret;
      },
    },
  }
);

/* ---------- Hooks ---------- */
artifactSchema.pre("save", function (next) {
  if (this.versions && this.versions.length > 10)
    this.versions = this.versions.slice(-10);

  if (this.sourceType === "codepen" && this.slugHash && !this.embedUrl) {
    this.embedUrl = `https://codepen.io/pen/embed/preview/${this.slugHash}`;
  }

  if (!this.slug && this.title) {
    this.slug = this.title
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .slice(0, 80);
  }
  next();
});

artifactSchema.path("price").validate(function (value) {
  if (this.priceType === "paid") return value > 0;
  return true;
}, "Paid artifacts must have a price greater than 0");

/* ---------- Indexes ---------- */
artifactSchema.index({ title: "text", tags: "text", tech: "text", description: "text" });
artifactSchema.index({ priceType: 1, status: 1 });
artifactSchema.index({ slugHash: 1 });
artifactSchema.index({ purchasedBy: 1 }); // Optimize ownership checks

// ✅ OPTIMIZATION: Missing indexes added
artifactSchema.index({ user: 1, isActive: 1, createdAt: -1 });       // getUserArtifacts
artifactSchema.index({ isActive: 1, status: 1, createdAt: -1 });     // main listing filter
artifactSchema.index({ trendingScore: -1, isActive: 1 });            // trending sort
artifactSchema.index({ popularityScore: -1, isActive: 1 });          // popular sort
artifactSchema.index({ score: -1, isActive: 1 });                    // general ranking
artifactSchema.index({ editorsChoice: 1, isActive: 1 });             // editors choice
artifactSchema.index({ trending: 1, isActive: 1 });                  // trending flag
artifactSchema.index({ popular: 1, isActive: 1 });                   // popular flag
artifactSchema.index({ category: 1, status: 1, createdAt: -1 });    // category filter


/* ---------- Methods ---------- */
artifactSchema.methods.addAuditLog = async function (action, ip, userAgent, actorId, byAdmin = false) {
  try {
    const AuditLog = mongoose.model("AuditLog");
    await AuditLog.create({
      targetId: this._id,
      targetType: "Artifact",
      actorId,
      action,
      ip,
      userAgent,
      details: { byAdmin },
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Artifact audit log failed:", err.message);
  }
};

artifactSchema.methods.incrementViews = async function (count = 1) {
  this.viewsCount += count;
  return this.save();
};

artifactSchema.methods.incrementDownloads = async function (count = 1) {
  this.downloadsCount += count;
  return this.save();
};

artifactSchema.methods.incrementImpressions = async function (count = 1) {
  this.impressionsCount += count;
  return this.save();
};

artifactSchema.methods.incrementShares = async function () {
  this.sharesCount += 1;
  return this.save();
};

/* ---------- Scoring ---------- */
artifactSchema.methods.updateScores = async function () {
  const now = new Date();
  const created = new Date(this.createdAt || now);
  const daysOld = (now - created) / (1000 * 60 * 60 * 24);

  // Basic weighted score
  this.score =
    (this.viewsCount || 0) * 1 +
    (this.downloadsCount || 0) * 3 +
    (this.averageRating || 0) * 5;

  // Trending score (recency + views/downloads)
  const recencyFactor = daysOld < 15 ? 1 : 0.5;
  this.trendingScore =
    ((this.viewsCount || 0) + (this.downloadsCount || 0) * 2) * recencyFactor;

  // Popularity score
  this.popularityScore = this.score;

  // Flags
  this.popular = this.popularityScore > 50;
  this.trending = this.trendingScore > 30 && daysOld < 15;

  await this.save();
};

/* ---------- Virtuals ---------- */
artifactSchema.virtual("discountedPrice").get(function () {
  if (this.priceType === "paid" && this.discount > 0)
    return Math.max(0, (this.price || 0) * (1 - (this.discount || 0) / 100));
  return this.price || 0;
});

artifactSchema.virtual("priceDisplay").get(function () {
  if (this.priceType === "free") return "Free";
   const p = (this.price || 0) * (1 - (this.discount || 0) / 100);
   return `${p.toFixed(0)} ${this.currency || "TKNS"}`;
 });

/* ---------- Model Export ---------- */
const Artifact =
  mongoose.models.Artifact ||
  mongoose.model("Artifact", artifactSchema, "artifacts");
export default Artifact;
