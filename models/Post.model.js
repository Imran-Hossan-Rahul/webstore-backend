import mongoose from "mongoose";
const { Schema } = mongoose;

const postSchema = new Schema(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000, // Reasonable limit for a "post"
    },
    images: [{
      type: String, // URLs
      trim: true
    }],
    media: [{
      type: { type: String, enum: ["image", "video", "file"] },
      url: String,
      name: String,
      size: Number,
      width: Number,
      height: Number
    }],
    
    // Engagement & Analytics
    views: { type: Number, default: 0 },
    viewHistory: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 0 },
        viewers: [{
           userId: { type: Schema.Types.ObjectId, ref: "User" },
           ip: String,
           timestamp: { type: Date, default: Date.now }
        }]
      }
    ],

    impressions: { type: Number, default: 0 },
    impressionHistory: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 0 },
      }
    ],

    likes: { type: Number, default: 0 },
    likedBy: [{ type: String }], // User IDs
    likeHistory: [
      {
        userId: { type: String },
        timestamp: { type: Date, default: Date.now }
      }
    ],

    sharesCount: { type: Number, default: 0 },
    shareHistory: [
      {
         userId: { type: String },
         platform: { type: String }, // e.g. "twitter", "facebook", "copy_link"
         timestamp: { type: Date, default: Date.now }
      }
    ],
    
    favoritesCount: { type: Number, default: 0 },
    
    commentsCount: { type: Number, default: 0 },
    
    // Rich Post Features
    postType: { 
      type: String, 
      enum: ["thought", "project", "tutorial", "text"], 
      default: "thought" 
    },
    category: { type: String, default: "General" },
    tags: [{ type: String, trim: true }], // Project tags
    
    // Structured Metadata (The "Spec Sheet")
    projectStats: {
      tools: [{ type: String }], // e.g., ["Figma", "Next.js"]
      timeSpent: { type: String }, // e.g., "4 hours"
      projectLink: { type: String }, // e.g., "github.com/..."
      difficulty: { 
        type: String, 
        enum: ["Beginner", "Intermediate", "Advanced", "Expert", "Master"],
        default: "Beginner"
      },
      location: { type: String }, // e.g., "Remote", "London"
      startDate: { type: Date }, // For project timeline
      endDate: { type: Date }, // Project end date
      phase: {
        type: String,
        enum: ["Planning", "In Development", "Live", "Maintenance", "Completed"],
        default: "Planning"
      },
      status: { 
        type: String,
        enum: ["Planning", "In Progress", "Completed", "On Hold"],
        default: "Planning"
      },
      
      // Phase 2: The Evolved Ecosystem
      livePreviewUrl: { type: String }, // For iframe preview
      documentationUrl: { type: String }, // Documentation link
      resources: [{
          title: { type: String }, // e.g., "Source Code"
          url: { type: String },
          type: { type: String, enum: ['link', 'file', 'github', 'figma'] }
      }],
      milestones: [{
          title: { type: String },
          date: { type: Date },
          status: { type: String, enum: ['planned', 'in_progress', 'completed'], default: 'planned' },
          description: { type: String }
      }],
      collaborators: [{ type: String }], // Array of names
      license: { type: String, default: "None" },
      originalEndDate: { type: Date }, // To track extensions
      extensions: [{
          newDate: { type: Date },
          reason: { type: String },
          date: { type: Date, default: Date.now }
      }]
    },
    
    // Metadata
    isEdited: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for feed performance
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);

export default Post;
