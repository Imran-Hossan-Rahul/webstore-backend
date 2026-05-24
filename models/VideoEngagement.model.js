// models/VideoEngagement.model.js
// Video engagement tracking - play, pause, seek, completion, quality
import mongoose, { Schema } from "mongoose";

const videoEngagementSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true },
    
    // Video identification
    video: {
      id: { type: String, required: true, index: true },
      title: String,
      url: String,
      duration: Number, // seconds
      type: String, // 'youtube', 'vimeo', 'native', 'embedded'
      category: String,
      tags: [String],
    },
    
    // Playback session
    session: {
      startTime: { type: Date, required: true, index: true },
      endTime: Date,
      duration: Number, // milliseconds
      
      // Completion
      completed: Boolean,
      completedAt: Date,
      completionPercentage: Number, // 0-100
      
      // Watch time
      totalWatchTime: Number, // seconds actually watched
      uniqueWatchTime: Number, // seconds watched (excluding rewinds)
      
      // Engagement
      engagementScore: Number, // 0-100
      attentionScore: Number, // 0-100
    },
    
    // Playback events timeline
    events: [{
      timestamp: Date,
      timeSinceStart: Number, // ms since session start
      videoTime: Number, // seconds into video
      
      eventType: { 
        type: String, 
        enum: [
          'play', 'pause', 'ended', 'seeking', 'seeked',
          'volumechange', 'ratechange', 'qualitychange',
          'fullscreenchange', 'pictureInPicture',
          'buffer_start', 'buffer_end', 'error'
        ],
        required: true
      },
      
      // Event data
      data: Schema.Types.Mixed, // volume, playbackRate, quality, etc.
      
      // Context
      isVisible: Boolean, // was video visible when event occurred
      isFocused: Boolean, // was tab focused
    }],
    
    // Playback metrics
    metrics: {
      // Play/pause
      playCount: Number,
      pauseCount: Number,
      
      // Seeking
      seekCount: Number,
      forwardSeeks: Number,
      backwardSeeks: Number,
      avgSeekDistance: Number, // seconds
      
      // Replays
      replayCount: Number, // times user rewatched sections
      replayedSegments: [{
        start: Number,
        end: Number,
        count: Number,
      }],
      
      // Speed
      playbackRateChanges: Number,
      avgPlaybackRate: Number,
      
      // Volume
      volumeChanges: Number,
      avgVolume: Number,
      muted: Boolean,
      mutedDuration: Number, // seconds
      
      // Quality
      qualityChanges: Number,
      avgQuality: String, // '360p', '720p', '1080p'
      autoQuality: Boolean,
      
      // Fullscreen
      fullscreenCount: Number,
      fullscreenDuration: Number, // seconds
      
      // Picture-in-Picture
      pipCount: Number,
      pipDuration: Number,
      
      // Buffering
      bufferCount: Number,
      totalBufferTime: Number, // seconds
      avgBufferTime: Number,
      
      // Errors
      errorCount: Number,
      errors: [{
        code: String,
        message: String,
        timestamp: Date,
      }],
    },
    
    // Watch pattern
    watchPattern: {
      // Segments watched (heatmap data)
      segments: [{
        start: Number, // seconds
        end: Number,
        watchCount: Number, // how many times watched
        avgAttention: Number, // 0-100
      }],
      
      // Milestones
      milestones: {
        started: Boolean,
        reached25: Boolean,
        reached50: Boolean,
        reached75: Boolean,
        reached100: Boolean,
        
        timeToReach25: Number, // seconds
        timeToReach50: Number,
        timeToReach75: Number,
        timeToReach100: Number,
      },
      
      // Drop-off points
      dropOffPoints: [{
        videoTime: Number,
        reason: String, // 'pause', 'seek', 'close', 'error'
      }],
      
      // Engagement curve
      engagementCurve: [{
        videoTime: Number,
        engagement: Number, // 0-100
      }],
    },
    
    // Interaction
    interaction: {
      // Controls used
      usedPlayButton: Boolean,
      usedProgressBar: Boolean,
      usedVolumeControl: Boolean,
      usedFullscreen: Boolean,
      usedQualitySelector: Boolean,
      usedSpeedControl: Boolean,
      usedCaptions: Boolean,
      
      // Keyboard shortcuts
      usedKeyboardShortcuts: Boolean,
      shortcuts: [{
        key: String,
        count: Number,
      }],
      
      // Gestures (mobile)
      usedSwipeGestures: Boolean,
      usedPinchZoom: Boolean,
      usedDoubleTap: Boolean,
    },
    
    // Context
    context: {
      // Device
      device: String,
      browser: String,
      screenSize: String,
      
      // Video visibility
      visibilityPercentage: Number, // % of time video was visible
      inViewport: Boolean,
      
      // Tab activity
      tabSwitches: Number,
      tabHiddenDuration: Number, // seconds
      
      // Network
      networkSpeed: String,
      hadNetworkIssues: Boolean,
      
      // Autoplay
      autoPlayed: Boolean,
      autoPlayBlocked: Boolean,
      
      // Referrer
      referrer: String,
      embedLocation: String,
    },
    
    // Captions/Subtitles
    captions: {
      enabled: Boolean,
      language: String,
      enabledAt: Number, // seconds into video
      disabledAt: Number,
      totalDuration: Number, // seconds with captions on
    },
    
    // Social interactions
    social: {
      liked: Boolean,
      disliked: Boolean,
      shared: Boolean,
      shareMethod: String, // 'facebook', 'twitter', 'email', 'copy_link'
      commented: Boolean,
      
      // Timestamps of interactions
      likedAt: Date,
      sharedAt: Date,
      commentedAt: Date,
    },
    
    // Conversion tracking
    conversion: {
      // CTA clicks
      ctaClicked: Boolean,
      ctaClickedAt: Number, // seconds into video
      ctaType: String, // 'subscribe', 'buy', 'learn_more', 'download'
      
      // Conversion
      converted: Boolean,
      convertedAt: Date,
      conversionValue: Number,
    },
    
    // A/B test variant (if applicable)
    experiment: {
      testId: { type: Schema.Types.ObjectId, ref: 'ABTest' },
      variantId: String,
      variantName: String,
    },
    
    // Quality of Experience (QoE)
    qoe: {
      // Overall score
      score: Number, // 0-100
      
      // Factors
      videoQuality: Number, // 0-100
      audioQuality: Number,
      bufferingImpact: Number, // negative impact
      errorImpact: Number,
      
      // User satisfaction (inferred)
      satisfactionScore: Number, // 0-100
      likelySatisfied: Boolean,
    },
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
videoEngagementSchema.index({ 'video.id': 1, 'session.startTime': -1 });
videoEngagementSchema.index({ sessionId: 1 });
videoEngagementSchema.index({ userId: 1, 'session.startTime': -1 });
videoEngagementSchema.index({ 'session.completed': 1 });
videoEngagementSchema.index({ 'session.engagementScore': -1 });
videoEngagementSchema.index({ 'conversion.converted': 1 });

// Method: Calculate engagement score
videoEngagementSchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  // Completion (0-40 points)
  score += this.session.completionPercentage * 0.4;
  
  // Watch time (0-30 points)
  const watchRatio = this.session.totalWatchTime / this.video.duration;
  score += Math.min(watchRatio * 30, 30);
  
  // Interaction (0-20 points)
  const interactions = this.metrics.playCount + this.metrics.seekCount + 
                       this.metrics.volumeChanges + this.metrics.fullscreenCount;
  score += Math.min(interactions * 2, 20);
  
  // Social (0-10 points)
  if (this.social.liked) score += 5;
  if (this.social.shared) score += 5;
  
  // Penalties
  if (this.metrics.errorCount > 0) score -= 10;
  if (this.metrics.bufferCount > 5) score -= 10;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Method: Detect drop-off points
videoEngagementSchema.methods.detectDropOffPoints = function() {
  const dropOffs = [];
  
  this.events.forEach((event, index) => {
    if (event.eventType === 'pause' || event.eventType === 'ended') {
      const nextEvent = this.events[index + 1];
      
      // If paused for >30s or ended early, it's a drop-off
      if (!nextEvent || (nextEvent.timestamp - event.timestamp) > 30000) {
        dropOffs.push({
          videoTime: event.videoTime,
          reason: event.eventType,
        });
      }
    }
  });
  
  return dropOffs;
};

// Static method: Get video performance
videoEngagementSchema.statics.getVideoPerformance = async function(videoId) {
  return await this.aggregate([
    { $match: { 'video.id': videoId } },
    {
      $group: {
        _id: null,
        totalViews: { $sum: 1 },
        uniqueViewers: { $addToSet: '$userId' },
        completions: { 
          $sum: { $cond: ['$session.completed', 1, 0] }
        },
        avgWatchTime: { $avg: '$session.totalWatchTime' },
        avgCompletionRate: { $avg: '$session.completionPercentage' },
        avgEngagement: { $avg: '$session.engagementScore' },
        totalWatchTime: { $sum: '$session.totalWatchTime' },
        conversions: {
          $sum: { $cond: ['$conversion.converted', 1, 0] }
        },
      }
    },
    {
      $project: {
        totalViews: 1,
        uniqueViewers: { $size: '$uniqueViewers' },
        completions: 1,
        completionRate: {
          $multiply: [{ $divide: ['$completions', '$totalViews'] }, 100]
        },
        avgWatchTime: 1,
        avgCompletionRate: 1,
        avgEngagement: 1,
        totalWatchTime: 1,
        conversions: 1,
        conversionRate: {
          $multiply: [{ $divide: ['$conversions', '$totalViews'] }, 100]
        },
      }
    }
  ]);
};

// Static method: Get engagement heatmap
videoEngagementSchema.statics.getEngagementHeatmap = async function(videoId) {
  return await this.aggregate([
    { $match: { 'video.id': videoId } },
    { $unwind: '$watchPattern.segments' },
    {
      $group: {
        _id: {
          start: '$watchPattern.segments.start',
          end: '$watchPattern.segments.end',
        },
        totalWatches: { $sum: '$watchPattern.segments.watchCount' },
        avgAttention: { $avg: '$watchPattern.segments.avgAttention' },
      }
    },
    { $sort: { '_id.start': 1 } }
  ]);
};

const VideoEngagement = mongoose.models.VideoEngagement || 
  mongoose.model("VideoEngagement", videoEngagementSchema, "videoEngagements");

export default VideoEngagement;

