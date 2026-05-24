// models/TabActivity.model.js
// Tab visibility & attention tracking with distraction analysis
import mongoose, { Schema } from "mongoose";

const tabActivitySchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true, index: true },
    
    // Detailed event timeline
    events: [{
      eventType: { 
        type: String, 
        enum: [
          'focus',      // tab gained focus
          'blur',       // tab lost focus
          'visible',    // tab became visible
          'hidden',     // tab became hidden
          'freeze',     // tab frozen by browser
          'resume',     // tab resumed from freeze
          'beforeunload', // user leaving page
        ],
        required: true 
      },
      timestamp: { type: Date, required: true },
      duration: Number, // ms in previous state
      
      // Context at time of event
      scrollPosition: Number,
      activeElement: String, // CSS selector
      mousePosition: { x: Number, y: Number },
      
      // Trigger
      trigger: String, // 'user_action', 'browser_action', 'system'
      triggerDetails: String,
    }],
    
    // Aggregated metrics
    metrics: {
      totalSwitches: { type: Number, default: 0 },
      totalTimeVisible: Number, // milliseconds
      totalTimeHidden: Number,
      totalTimeFocused: Number,
      totalTimeBlurred: Number,
      
      // Averages
      avgVisibleDuration: Number,
      avgHiddenDuration: Number,
      avgFocusDuration: Number,
      
      // Extremes
      longestVisibleStreak: Number,
      longestHiddenStreak: Number,
      shortestVisibleStreak: Number,
      
      // Frequency
      switchesPerMinute: Number,
      switchesPerHour: Number,
      
      // Patterns
      visibleRatio: Number, // 0-1, time visible / total time
      focusRatio: Number, // time focused / total time
    },
    
    // Attention analysis
    attention: {
      // Overall attention score (0-100)
      score: { type: Number, min: 0, max: 100, default: 50 },
      
      // Attention quality
      quality: { 
        type: String, 
        enum: ['excellent', 'good', 'fair', 'poor', 'distracted'],
        default: 'fair'
      },
      
      // Distraction indicators
      isHighlyDistracted: Boolean,
      isMultitasking: Boolean,
      isPassiveViewing: Boolean, // visible but no interaction
      
      // Distraction score (0-100, higher = more distracted)
      distractionScore: { type: Number, min: 0, max: 100, default: 0 },
      
      // Engagement indicators
      sustainedAttentionPeriods: Number, // count of >2min focused periods
      microDistractions: Number, // <10s switches
      macroDistractions: Number, // >1min away
      
      // Return behavior
      avgReturnTime: Number, // avg time to return after leaving
      returnRate: Number, // % of times user returned vs abandoned
    },
    
    // Multitasking analysis
    multitasking: {
      score: { type: Number, min: 0, max: 100, default: 0 },
      
      // Patterns
      rapidSwitching: Boolean, // >10 switches in 1 minute
      parallelTasks: Number, // estimated concurrent tasks
      
      // Switch patterns
      switchPatterns: [{
        fromState: String,
        toState: String,
        frequency: Number,
        avgDuration: Number,
      }],
      
      // Time distribution
      timeDistribution: {
        focused: Number, // % time fully focused
        lightMultitasking: Number, // occasional switches
        heavyMultitasking: Number, // frequent switches
        abandoned: Number, // left and didn't return
      },
    },
    
    // Behavioral patterns
    patterns: {
      // Session patterns
      hasWarmup: Boolean, // started slow, then engaged
      hasFatigue: Boolean, // engagement decreased over time
      hasPeakEngagement: Boolean, // high engagement period
      
      // Switch patterns
      hasRegularBreaks: Boolean, // periodic switches
      hasRandomSwitches: Boolean, // unpredictable
      hasTaskCompletion: Boolean, // focused until done
      
      // Return patterns
      alwaysReturns: Boolean,
      sometimesReturns: Boolean,
      rarelyReturns: Boolean,
      
      // Time of day patterns
      morningUser: Boolean,
      afternoonUser: Boolean,
      eveningUser: Boolean,
      nightOwl: Boolean,
    },
    
    // Context switches (what user switched to)
    contextSwitches: [{
      timestamp: Date,
      switchedTo: String, // 'another_tab', 'another_window', 'another_app', 'unknown'
      duration: Number, // how long they were away
      returnedToSamePage: Boolean,
      activityAfterReturn: String, // 'continued', 'new_action', 'left_immediately'
    }],
    
    // Engagement timeline (minute-by-minute)
    engagementTimeline: [{
      minute: Number, // minute since session start
      visibleSeconds: Number,
      focusedSeconds: Number,
      interactions: Number, // clicks, scrolls, keys
      engagementScore: Number, // 0-100 for this minute
    }],
    
    // Correlation with other metrics
    correlation: {
      mouseMovementId: { type: Schema.Types.ObjectId, ref: 'MouseMovement' },
      keystrokeTimingId: { type: Schema.Types.ObjectId, ref: 'KeystrokeTiming' },
      
      // Activity correlation
      mouseActivityDuringVisible: Number,
      mouseActivityDuringHidden: Number,
      keystrokesDuringVisible: Number,
      keystrokesDuringHidden: Number,
      
      // Engagement correlation
      scrollDepthWhenVisible: Number,
      scrollDepthWhenHidden: Number,
    },
    
    // Device & browser
    device: {
      platform: String,
      userAgent: String,
      supportsPageVisibility: Boolean,
      supportsFocusEvents: Boolean,
      
      // Battery (if available)
      batteryLevel: Number,
      isCharging: Boolean,
      
      // Network
      connectionType: String, // '4g', 'wifi', 'ethernet'
      effectiveType: String, // 'slow-2g', '2g', '3g', '4g'
    },
    
    // Session context
    startTime: { type: Date, default: Date.now, index: true },
    endTime: Date,
    duration: Number, // total session duration
    
    // Quality indicators
    quality: {
      dataCompleteness: Number, // 0-100, how complete the data is
      hasGaps: Boolean, // missing data periods
      gapDuration: Number, // total ms of gaps
      reliability: Number, // 0-100, data reliability score
    },
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
tabActivitySchema.index({ sessionId: 1, page: 1 });
tabActivitySchema.index({ userId: 1, startTime: -1 });
tabActivitySchema.index({ page: 1, 'attention.score': -1 });
tabActivitySchema.index({ 'multitasking.score': -1 });
tabActivitySchema.index({ 'attention.distractionScore': -1 });
tabActivitySchema.index({ 'metrics.switchesPerMinute': -1 });

// Pre-save hook: Calculate attention score
tabActivitySchema.pre('save', function(next) {
  if (this.metrics.totalTimeVisible && this.metrics.totalSwitches !== undefined) {
    const visibleRatio = this.metrics.visibleRatio || 0;
    const switchFreq = this.metrics.switchesPerMinute || 0;
    
    // Attention score formula
    let score = 100;
    score -= (1 - visibleRatio) * 40; // penalize hidden time
    score -= Math.min(switchFreq * 5, 40); // penalize frequent switches
    score = Math.max(0, Math.min(100, score));
    
    this.attention.score = Math.round(score);
    
    // Determine quality
    if (score >= 80) this.attention.quality = 'excellent';
    else if (score >= 60) this.attention.quality = 'good';
    else if (score >= 40) this.attention.quality = 'fair';
    else if (score >= 20) this.attention.quality = 'poor';
    else this.attention.quality = 'distracted';
    
    // Distraction score (inverse of attention)
    this.attention.distractionScore = 100 - score;
    this.attention.isHighlyDistracted = score < 30;
    this.attention.isMultitasking = switchFreq > 5;
  }
  
  next();
});

// Method: Analyze engagement pattern
tabActivitySchema.methods.analyzeEngagementPattern = function() {
  const timeline = this.engagementTimeline || [];
  if (timeline.length < 3) return 'insufficient_data';
  
  const scores = timeline.map(t => t.engagementScore);
  const firstThird = scores.slice(0, Math.floor(scores.length / 3));
  const lastThird = scores.slice(-Math.floor(scores.length / 3));
  
  const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
  const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
  
  if (avgLast > avgFirst + 20) return 'increasing'; // warming up
  if (avgLast < avgFirst - 20) return 'decreasing'; // fatigue
  if (Math.abs(avgLast - avgFirst) < 10) return 'stable'; // consistent
  return 'variable'; // unpredictable
};

// Static method: Get attention distribution
tabActivitySchema.statics.getAttentionDistribution = async function(filters = {}) {
  return await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: '$attention.quality',
        count: { $sum: 1 },
        avgScore: { $avg: '$attention.score' },
        avgSwitches: { $avg: '$metrics.totalSwitches' },
      }
    },
    { $sort: { avgScore: -1 } }
  ]);
};

const TabActivity = mongoose.models.TabActivity || 
  mongoose.model("TabActivity", tabActivitySchema, "tabActivities");

export default TabActivity;
