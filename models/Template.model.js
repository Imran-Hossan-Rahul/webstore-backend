import mongoose from "mongoose";
const { Schema } = mongoose;

const buttonTemplateSchema = new Schema(
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
        "Site Templates",
        "eCommerce",
        "Admin Dashboard",
        "Animation",
        "Blogging",
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
    impressionHistory: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 0 },
      }
    ],

    sharesCount: { type: Number, default: 0 },
    shareHistory: [
      {
         userId: { type: String },
         platform: { type: String },
         timestamp: { type: Date, default: Date.now }
      }
    ],

    priceType: { type: String, enum: ["free", "paid"], default: "free" },
    price: { type: Number, default: 0, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    currency: { type: String, default: "USD", uppercase: true },
    purchasedBy: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],

    githubLink: { type: String, trim: true },
    liveLink: { type: String, trim: true },
    previewFile: { type: String, required: true, trim: true },
    fileUrl: { type: String, trim: true },
    projectFile: { type: String, required: true, trim: true },
    fileSize: { type: Number, min: 0 },
    fileType: { type: String, trim: true, lowercase: true },

    likeCount: { type: Number, default: 0 },
    likedBy: [{ type: String }], // userId OR visitorId
    likeHistory: [
      {
        userId: { type: String },
        timestamp: { type: Date, default: Date.now }
      }
    ],

    salesCount: { type: Number, default: 0 },
    downloadsCount: { type: Number, default: 0 },
    downloadHistory: [
      {
        userId: { type: String },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    viewsCount: { type: Number, default: 0 },
    viewHistory: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 1 },
        viewers: [
          {
            userId: { type: String },
            ip: { type: String },
            country: { type: String },
            userAgent: { type: String },
            timestamp: { type: Date, default: Date.now }
          }
        ]
      }
    ],
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
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verifiedSeller: { type: Boolean, default: false },

    versions: [
      {
        version: { type: String, trim: true },
        changelog: { type: String, trim: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    isActive: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    editorsChoice: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 },

    auditLogs: [
      {
        action: { type: String, trim: true },
        timestamp: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
        byAdmin: { type: Boolean, default: false },
        actor: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
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
buttonTemplateSchema.pre("save", function (next) {
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

buttonTemplateSchema.path("price").validate(function (value) {
  if (this.priceType === "paid") return value > 0;
  return true;
}, "Paid templates must have a price greater than 0");

/* ---------- Indexes ---------- */
buttonTemplateSchema.index({ title: "text", tags: "text", tech: "text", category: 1 });
buttonTemplateSchema.index({ priceType: 1, status: 1 });
buttonTemplateSchema.index({ slugHash: 1 });

/* ---------- Methods ---------- */
buttonTemplateSchema.methods.addAuditLog = function (
  action,
  ip,
  userAgent,
  actor,
  byAdmin = false
) {
  this.auditLogs = this.auditLogs || [];
  this.auditLogs.push({ action, ip, userAgent, actor, byAdmin });
  if (this.auditLogs.length > 100) this.auditLogs = this.auditLogs.slice(-100);
  return this.save();
};

buttonTemplateSchema.methods.incrementViews = async function (count = 1) {
  const model = this.constructor;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if today's entry exists
  const existingEntry = this.viewHistory?.find(entry => {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    return entryDate.getTime() === today.getTime();
  });
  
  if (existingEntry) {
    // Update existing entry
    const result = await model.findOneAndUpdate(
      { _id: this._id, 'viewHistory.date': { $gte: today, $lt: new Date(today.getTime() + 24*60*60*1000) } },
      { 
        $inc: { viewsCount: count, 'viewHistory.$.count': count }
      },
      { new: true }
    ).select('viewsCount viewHistory');
    this.viewsCount = result.viewsCount;
    this.viewHistory = result.viewHistory;
    return result;
  } else {
    // Add new entry
    const result = await model.findByIdAndUpdate(
      this._id,
      { 
        $inc: { viewsCount: count },
        $push: { viewHistory: { date: today, count } }
      },
      { new: true }
    ).select('viewsCount viewHistory');
    this.viewsCount = result.viewsCount;
    this.viewHistory = result.viewHistory;
    return result;
  }
};

buttonTemplateSchema.methods.incrementDownloads = async function (count = 1, userId = null) {
  const model = this.constructor;
  const update = { 
    $inc: { downloadsCount: count }
  };
  
  if (userId) {
    update.$push = { downloadHistory: { userId, timestamp: new Date() } };
  }
  
  const result = await model
    .findByIdAndUpdate(
      this._id,
      update,
      { new: true }
    )
    .select("downloadsCount downloadHistory");
  this.downloadsCount = result.downloadsCount;
  this.downloadHistory = result.downloadHistory;
  return result;
};

buttonTemplateSchema.methods.incrementImpressions = async function (count = 1) {
    const model = this.constructor;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today's entry exists
    const existingEntry = this.impressionHistory?.find(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === today.getTime();
    });

    if (existingEntry) {
        const result = await model.findOneAndUpdate(
            { _id: this._id, 'impressionHistory.date': { $gte: today, $lt: new Date(today.getTime() + 24*60*60*1000) } },
            { $inc: { impressionsCount: count, 'impressionHistory.$.count': count } },
            { new: true }
        ).select('impressionsCount impressionHistory');
        return result;
    } else {
        const result = await model.findByIdAndUpdate(
            this._id,
            { 
                $inc: { impressionsCount: count },
                $push: { impressionHistory: { date: today, count } }
            },
            { new: true }
        ).select('impressionsCount impressionHistory');
        return result;
    }
};

buttonTemplateSchema.methods.incrementShares = async function (platform, userId = null) {
  const model = this.constructor;
  const update = { 
    $inc: { sharesCount: 1 },
    $push: { shareHistory: { userId, platform, timestamp: new Date() } }
  };
  
  const result = await model.findByIdAndUpdate(this._id, update, { new: true });
  return result;
};

/* ---------- Scoring ---------- */
buttonTemplateSchema.methods.updateScores = async function () {
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
buttonTemplateSchema.virtual("discountedPrice").get(function () {
  if (this.priceType === "paid" && this.discount > 0)
    return Math.max(0, (this.price || 0) * (1 - (this.discount || 0) / 100));
  return this.price || 0;
});

buttonTemplateSchema.virtual("priceDisplay").get(function () {
  if (this.priceType === "free") return "Free";
  const p = this.discountedPrice;
  return `${this.currency || "USD"} ${p.toFixed(2)}`;
});

/* ---------- Model Export ---------- */
const ButtonTemplate =
  mongoose.models.ButtonTemplate ||
  mongoose.model("ButtonTemplate", buttonTemplateSchema, "buttonTemplates");
export default ButtonTemplate;
