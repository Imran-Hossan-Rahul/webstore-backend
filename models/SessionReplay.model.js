// models/SessionReplay.model.js
// Session replay - record and playback user sessions like a video
import mongoose, { Schema } from "mongoose";

const sessionReplaySchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    
    // Recording metadata
    recording: {
      startTime: { type: Date, required: true, index: true },
      endTime: Date,
      duration: Number, // milliseconds
      
      // Recording quality
      quality: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'ultra'],
        default: 'medium'
      },
      fps: Number, // frames per second captured
      
      // Status
      status: { 
        type: String, 
        enum: ['recording', 'processing', 'ready', 'failed', 'expired'],
        default: 'recording',
        index: true
      },
      
      // Size
      totalEvents: Number,
      compressedSizeKB: Number,
      uncompressedSizeKB: Number,
      compressionRatio: Number,
    },
    
    // DOM snapshots (incremental)
    snapshots: [{
      timestamp: Number, // ms since recording start
      type: { 
        type: String, 
        enum: ['full', 'incremental'],
        required: true
      },
      
      // Full snapshot (initial page state)
      html: String, // compressed HTML
      css: String, // inline styles
      
      // Incremental snapshot (changes only)
      mutations: [{
        type: { type: String }, // 'childList', 'attributes', 'characterData'
        target: { type: String }, // CSS selector or node ID
        value: { type: Schema.Types.Mixed },
        oldValue: { type: Schema.Types.Mixed },
        addedNodes: { type: Number },
        removedNodes: { type: Number },
        attributeName: { type: String },
      }],
      
      // Viewport
      viewportWidth: Number,
      viewportHeight: Number,
      scrollX: Number,
      scrollY: Number,
    }],
    
    // User interactions (mouse, keyboard, touch)
    interactions: [{
      timestamp: Number, // ms since recording start
      type: { 
        type: String, 
        enum: [
          'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
          'wheel', 'scroll',
          'keydown', 'keyup', 'input',
          'touchstart', 'touchmove', 'touchend',
          'focus', 'blur',
          'resize', 'orientationchange'
        ],
        required: true
      },
      
      // Mouse/touch position
      x: Number,
      y: Number,
      
      // Target element
      target: String, // CSS selector
      
      // Event data
      data: Schema.Types.Mixed, // key, button, deltaY, etc.
      
      // Sanitized (no sensitive data)
      sanitized: Boolean,
    }],
    
    // Network activity
    networkActivity: [{
      timestamp: Number,
      type: { type: String }, // 'xhr', 'fetch', 'websocket', 'navigation'
      method: String, // GET, POST, etc.
      url: String, // sanitized
      
      // Timing
      startTime: Number,
      endTime: Number,
      duration: Number,
      
      // Request
      requestHeaders: Schema.Types.Mixed, // sanitized
      requestBody: String, // sanitized/hashed
      
      // Response
      statusCode: Number,
      responseHeaders: Schema.Types.Mixed,
      responseBody: String, // sanitized/hashed
      responseSize: Number,
      
      // Errors
      error: String,
      errorStack: String,
    }],
    
    // Console logs
    consoleLogs: [{
      timestamp: Number,
      level: { 
        type: String, 
        enum: ['log', 'info', 'warn', 'error', 'debug'],
        required: true
      },
      message: String, // sanitized
      args: [Schema.Types.Mixed], // sanitized
      stack: String, // for errors
      
      // Source
      source: String, // file:line:column
      category: String, // 'user', 'library', 'framework'
    }],
    
    // JavaScript errors
    errors: [{
      timestamp: Number,
      type: { type: String }, // 'error', 'unhandledrejection', 'securityerror'
      message: String,
      stack: String,
      
      // Error details
      filename: String,
      lineno: Number,
      colno: Number,
      
      // Context
      userAgent: String,
      url: String,
      
      // Severity
      severity: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      
      // Impact
      causedCrash: Boolean,
      affectedFeature: String,
    }],
    
    // Performance metrics
    performance: [{
      timestamp: Number,
      type: { type: String }, // 'navigation', 'resource', 'paint', 'measure'
      name: String,
      
      // Timing
      startTime: Number,
      duration: Number,
      
      // Navigation timing
      navigationTiming: {
        dns: Number,
        tcp: Number,
        request: Number,
        response: Number,
        domProcessing: Number,
        domContentLoaded: Number,
        loadComplete: Number,
      },
      
      // Resource timing
      resourceTiming: {
        name: String,
        type: { type: String },
        size: Number,
        duration: Number,
        cached: Boolean,
      },
      
      // Paint timing
      paintTiming: {
        firstPaint: Number,
        firstContentfulPaint: Number,
        largestContentfulPaint: Number,
      },
      
      // Core Web Vitals
      webVitals: {
        LCP: Number, // Largest Contentful Paint
        FID: Number, // First Input Delay
        CLS: Number, // Cumulative Layout Shift
        TTFB: Number, // Time to First Byte
        FCP: Number, // First Contentful Paint
        INP: Number, // Interaction to Next Paint
      },
    }],
    
    // Page views (navigation within session)
    pageViews: [{
      timestamp: Number,
      url: String, // sanitized
      title: String,
      referrer: String,
      
      // Timing
      timeOnPage: Number, // ms
      
      // Engagement
      scrollDepth: Number, // 0-100
      interactions: Number,
      rageClicks: Number,
      exitIntent: Boolean,
    }],
    
    // Custom events (business logic)
    customEvents: [{
      timestamp: Number,
      type: { type: String }, // 'purchase', 'signup', 'feature_used'
      category: { type: String },
      properties: { type: Schema.Types.Mixed },
      value: { type: Number },
    }],
    
    // Metadata
    metadata: {
      // Device
      device: String,
      browser: String,
      os: String,
      screenResolution: String,
      
      // Location
      country: String,
      city: String,
      timezone: String,
      
      // User
      isAuthenticated: Boolean,
      userRole: String,
      
      // Session
      isFirstSession: Boolean,
      sessionNumber: Number,
      
      // Referral
      referrer: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
    },
    
    // Analysis (computed)
    analysis: {
      // Engagement
      engagementScore: { type: Number, min: 0, max: 100 },
      attentionScore: { type: Number, min: 0, max: 100 },
      frustrationScore: { type: Number, min: 0, max: 100 },
      
      // Behavior
      hasRageClicks: Boolean,
      hasDeadClicks: Boolean, // clicks with no effect
      hasErrorClicks: Boolean, // clicks that caused errors
      hasFormAbandonment: Boolean,
      hasExitIntent: Boolean,
      
      // Conversion
      converted: Boolean,
      conversionValue: Number,
      conversionEvent: String,
      
      // Issues
      hadErrors: Boolean,
      errorCount: Number,
      hadPerformanceIssues: Boolean,
      hadNetworkIssues: Boolean,
      
      // Quality
      dataQuality: { type: Number, min: 0, max: 100 }, // completeness
      hasGaps: Boolean, // missing data periods
      gapDuration: Number, // total ms of gaps
    },
    
    // Tags (for filtering/searching)
    tags: [String], // 'converted', 'had_error', 'frustrated', 'high_value'
    
    // Privacy
    privacy: {
      // Sanitization applied
      textSanitized: Boolean,
      inputsSanitized: Boolean,
      imagesSanitized: Boolean,
      
      // Redacted elements
      redactedSelectors: [String], // CSS selectors of redacted elements
      
      // User consent
      consentGiven: Boolean,
      consentTimestamp: Date,
    },
    
    // Storage
    storage: {
      // S3/Cloud storage
      storageProvider: String, // 's3', 'gcs', 'azure'
      storagePath: String,
      storageUrl: String, // signed URL for playback
      
      // Compression
      compressionAlgorithm: String, // 'gzip', 'brotli', 'lz4'
      encrypted: Boolean,
      
      // Lifecycle
      expiresAt: Date,
      archived: Boolean,
      archivedAt: Date,
    },
    
    // Playback
    playback: {
      viewCount: { type: Number, default: 0 },
      lastViewedAt: Date,
      lastViewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      
      // Bookmarks (interesting moments)
      bookmarks: [{
        timestamp: Number,
        label: String,
        type: String, // 'error', 'conversion', 'rage_click', 'custom'
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: Date,
      }],
      
      // Comments
      comments: [{
        timestamp: Number,
        text: String,
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: Date,
      }],
    },
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days (configurable)
  }
);

// Indexes
sessionReplaySchema.index({ sessionId: 1 }, { unique: true });
sessionReplaySchema.index({ userId: 1, 'recording.startTime': -1 });
sessionReplaySchema.index({ visitorId: 1, 'recording.startTime': -1 });
sessionReplaySchema.index({ 'recording.status': 1 });
sessionReplaySchema.index({ 'analysis.engagementScore': -1 });
sessionReplaySchema.index({ 'analysis.frustrationScore': -1 });
sessionReplaySchema.index({ 'analysis.converted': 1 });
sessionReplaySchema.index({ tags: 1 });
sessionReplaySchema.index({ 'metadata.country': 1 });
sessionReplaySchema.index({ 'recording.startTime': -1 });

// Virtual: Playback URL
sessionReplaySchema.virtual('playbackUrl').get(function() {
  return `/admin/replay/${this.sessionId}`;
});

// Method: Add bookmark
sessionReplaySchema.methods.addBookmark = function(timestamp, label, type, userId) {
  this.playback.bookmarks.push({
    timestamp,
    label,
    type,
    createdBy: userId,
    createdAt: new Date(),
  });
  return this.save();
};

// Method: Add comment
sessionReplaySchema.methods.addComment = function(timestamp, text, userId) {
  this.playback.comments.push({
    timestamp,
    text,
    author: userId,
    createdAt: new Date(),
  });
  return this.save();
};

// Method: Increment view count
sessionReplaySchema.methods.recordView = function(userId) {
  this.playback.viewCount += 1;
  this.playback.lastViewedAt = new Date();
  this.playback.lastViewedBy = userId;
  return this.save();
};

// Method: Calculate engagement score
sessionReplaySchema.methods.calculateEngagementScore = function() {
  let score = 50; // baseline
  
  const duration = this.recording.duration || 0;
  const interactions = this.interactions?.length || 0;
  const pageViews = this.pageViews?.length || 0;
  
  // Duration scoring (0-30 points)
  if (duration > 600000) score += 30; // >10 min
  else if (duration > 300000) score += 20; // >5 min
  else if (duration > 60000) score += 10; // >1 min
  else score -= 10; // <1 min
  
  // Interaction scoring (0-40 points)
  const interactionRate = duration > 0 ? (interactions / duration) * 60000 : 0; // per minute
  if (interactionRate > 20) score += 40;
  else if (interactionRate > 10) score += 30;
  else if (interactionRate > 5) score += 20;
  else if (interactionRate > 1) score += 10;
  
  // Page view scoring (0-20 points)
  if (pageViews > 5) score += 20;
  else if (pageViews > 3) score += 15;
  else if (pageViews > 1) score += 10;
  
  // Penalties
  if (this.analysis.hasRageClicks) score -= 15;
  if (this.analysis.hadErrors) score -= 10;
  if (this.analysis.hasFormAbandonment) score -= 10;
  
  // Bonuses
  if (this.analysis.converted) score += 20;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Static method: Find high-value sessions
sessionReplaySchema.statics.findHighValueSessions = async function(limit = 10) {
  return await this.find({
    'recording.status': 'ready',
    $or: [
      { 'analysis.converted': true },
      { 'analysis.engagementScore': { $gte: 80 } },
      { 'analysis.frustrationScore': { $gte: 70 } },
      { 'analysis.hadErrors': true },
    ]
  })
  .sort({ 'recording.startTime': -1 })
  .limit(limit)
  .lean();
};

// Static method: Get session statistics
sessionReplaySchema.statics.getStatistics = async function(filters = {}) {
  return await this.aggregate([
    { $match: { ...filters, 'recording.status': 'ready' } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        avgDuration: { $avg: '$recording.duration' },
        avgEngagement: { $avg: '$analysis.engagementScore' },
        avgFrustration: { $avg: '$analysis.frustrationScore' },
        conversionRate: { 
          $avg: { $cond: ['$analysis.converted', 1, 0] }
        },
        errorRate: {
          $avg: { $cond: ['$analysis.hadErrors', 1, 0] }
        },
        totalViews: { $sum: '$playback.viewCount' },
      }
    }
  ]);
};

const SessionReplay = mongoose.models.SessionReplay || 
  mongoose.model("SessionReplay", sessionReplaySchema, "sessionReplays");

export default SessionReplay;
