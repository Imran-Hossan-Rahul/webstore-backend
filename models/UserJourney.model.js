// models/UserJourney.model.js
// User journey mapping - visualize paths users take through the site
import mongoose, { Schema } from "mongoose";

const userJourneySchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    
    // Journey metadata
    journey: {
      startTime: { type: Date, required: true, index: true },
      endTime: Date,
      duration: Number, // milliseconds
      
      // Journey type
      type: { 
        type: String, 
        enum: ['exploration', 'goal_oriented', 'search', 'comparison', 'purchase', 'support', 'abandoned'],
        index: true
      },
      
      // Status
      status: { 
        type: String, 
        enum: ['active', 'completed', 'abandoned', 'converted'],
        default: 'active',
        index: true
      },
      
      // Outcome
      outcome: {
        converted: Boolean,
        conversionType: String, // 'purchase', 'signup', 'download', 'contact'
        conversionValue: Number,
        goalCompleted: Boolean,
        goalName: String,
      },
    },
    
    // Path (sequence of pages/screens)
    path: [{
      // Page info
      url: { type: String, required: true },
      title: String,
      pageType: String, // 'home', 'product', 'category', 'checkout', 'codex'
      
      // Timing
      enteredAt: { type: Date, required: true },
      exitedAt: Date,
      timeOnPage: Number, // milliseconds
      
      // Sequence
      stepNumber: { type: Number, required: true },
      isEntryPage: Boolean,
      isExitPage: Boolean,
      
      // Engagement
      scrollDepth: Number, // 0-100
      interactions: Number, // clicks, inputs, etc.
      engagementScore: Number, // 0-100
      
      // Navigation
      entryMethod: String, // 'direct', 'link', 'back_button', 'forward_button', 'search'
      exitMethod: String, // 'link', 'back_button', 'close_tab', 'timeout'
      
      // Referrer
      referrer: String,
      
      // Events on this page
      events: [{
        type: String,
        timestamp: Date,
        details: Schema.Types.Mixed,
      }],
      
      // Errors on this page
      errors: [{
        message: String,
        timestamp: Date,
      }],
    }],
    
    // Journey analysis
    analysis: {
      // Path characteristics
      totalSteps: Number,
      uniquePages: Number,
      backtrackCount: Number, // times user went back
      loopCount: Number, // times user revisited same page
      
      // Efficiency
      pathEfficiency: Number, // 0-100, how direct the path was
      optimalPathLength: Number, // shortest possible path to goal
      actualPathLength: Number,
      wastedSteps: Number, // steps that didn't contribute to goal
      
      // Patterns
      hasLinearPath: Boolean, // straight path, no backtracking
      hasExploratoryPath: Boolean, // lots of browsing
      hasSearchPath: Boolean, // used search
      hasComparisonPath: Boolean, // viewed multiple similar items
      
      // Bottlenecks
      bottlenecks: [{
        page: String,
        reason: String, // 'long_time', 'high_exit_rate', 'errors', 'confusion'
        impact: String, // 'low', 'medium', 'high'
        timeSpent: Number,
      }],
      
      // Drop-off points
      dropOffPoints: [{
        page: String,
        stepNumber: Number,
        dropOffRate: Number, // % of users who left at this step
        reason: String,
      }],
    },
    
    // Funnel tracking
    funnel: {
      name: String, // 'checkout', 'signup', 'onboarding'
      steps: [{
        name: String,
        url: String,
        completed: Boolean,
        completedAt: Date,
        timeToComplete: Number, // ms from funnel start
        attempts: Number, // how many times user visited this step
      }],
      
      // Funnel metrics
      currentStep: Number,
      completedSteps: Number,
      totalSteps: Number,
      completionRate: Number, // 0-100
      
      // Drop-off
      droppedOff: Boolean,
      dropOffStep: Number,
      dropOffReason: String,
    },
    
    // Goals
    goals: [{
      name: String,
      type: String, // 'page_view', 'event', 'duration', 'engagement'
      target: Schema.Types.Mixed,
      achieved: Boolean,
      achievedAt: Date,
      timeToAchieve: Number, // ms from journey start
      value: Number,
    }],
    
    // Micro-conversions (small wins along the way)
    microConversions: [{
      name: String,
      type: String, // 'video_play', 'form_start', 'add_to_cart', 'social_share'
      timestamp: Date,
      value: Number,
    }],
    
    // User intent (inferred)
    intent: {
      primary: String, // 'browse', 'buy', 'learn', 'compare', 'support'
      confidence: Number, // 0-100
      
      // Intent signals
      signals: [{
        type: String,
        weight: Number,
        reason: String,
      }],
      
      // Intent changes
      intentChanges: [{
        from: String,
        to: String,
        timestamp: Date,
        trigger: String,
      }],
    },
    
    // Behavior patterns
    behavior: {
      // Browsing style
      browsingStyle: String, // 'focused', 'exploratory', 'hesitant', 'decisive'
      
      // Decision making
      decisionSpeed: String, // 'fast', 'medium', 'slow'
      researchIntensity: String, // 'low', 'medium', 'high'
      
      // Engagement
      engagementLevel: String, // 'low', 'medium', 'high'
      attentionSpan: Number, // average time per page
      
      // Friction points
      frictionPoints: [{
        page: String,
        type: String, // 'confusion', 'error', 'slow_load', 'form_issue'
        severity: String,
        timestamp: Date,
      }],
      
      // Positive signals
      positiveSignals: [{
        type: String, // 'high_engagement', 'quick_decision', 'goal_achieved'
        timestamp: Date,
      }],
    },
    
    // Segmentation
    segment: {
      // User type
      userType: String, // 'new', 'returning', 'loyal', 'at_risk', 'churned'
      
      // Value
      valueSegment: String, // 'high_value', 'medium_value', 'low_value'
      lifetimeValue: Number,
      
      // Behavior
      behaviorSegment: String, // 'researcher', 'impulse_buyer', 'bargain_hunter'
      
      // Device
      deviceSegment: String, // 'mobile', 'desktop', 'tablet'
      
      // Geography
      geoSegment: String,
    },
    
    // Attribution
    attribution: {
      // First touch
      firstTouch: {
        source: String,
        medium: String,
        campaign: String,
        timestamp: Date,
      },
      
      // Last touch
      lastTouch: {
        source: String,
        medium: String,
        campaign: String,
        timestamp: Date,
      },
      
      // All touchpoints
      touchpoints: [{
        source: String,
        medium: String,
        campaign: String,
        timestamp: Date,
        contribution: Number, // 0-100, estimated contribution to conversion
      }],
      
      // Attribution model
      model: String, // 'first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'
    },
    
    // Context
    context: {
      // Device
      device: String,
      browser: String,
      os: String,
      
      // Location
      country: String,
      city: String,
      timezone: String,
      
      // Time
      dayOfWeek: String,
      hourOfDay: Number,
      isWeekend: Boolean,
      isBusinessHours: Boolean,
      
      // Referral
      referrer: String,
      referrerDomain: String,
      
      // Campaign
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      utmTerm: String,
      utmContent: String,
    },
    
    // Comparison (for A/B testing)
    experiment: {
      inExperiment: Boolean,
      experimentId: { type: Schema.Types.ObjectId, ref: 'ABTest' },
      variantId: String,
      variantName: String,
    },
    
    // Tags
    tags: [String], // 'converted', 'high_value', 'abandoned_cart', 'support_needed'
  },
  { 
    timestamps: true,
    expireAfterSeconds: 15552000, // 180 days
  }
);

// Indexes
userJourneySchema.index({ sessionId: 1 }, { unique: true });
userJourneySchema.index({ userId: 1, 'journey.startTime': -1 });
userJourneySchema.index({ visitorId: 1, 'journey.startTime': -1 });
userJourneySchema.index({ 'journey.type': 1 });
userJourneySchema.index({ 'journey.status': 1 });
userJourneySchema.index({ 'journey.outcome.converted': 1 });
userJourneySchema.index({ 'funnel.name': 1, 'funnel.completionRate': -1 });
userJourneySchema.index({ 'intent.primary': 1 });
userJourneySchema.index({ 'segment.userType': 1 });
userJourneySchema.index({ tags: 1 });

// Method: Calculate path efficiency
userJourneySchema.methods.calculatePathEfficiency = function() {
  if (!this.analysis.optimalPathLength || !this.analysis.actualPathLength) return 0;
  
  const efficiency = (this.analysis.optimalPathLength / this.analysis.actualPathLength) * 100;
  return Math.min(100, Math.round(efficiency));
};

// Method: Detect bottlenecks
userJourneySchema.methods.detectBottlenecks = function() {
  const bottlenecks = [];
  const avgTimePerPage = this.journey.duration / this.path.length;
  
  this.path.forEach((step, index) => {
    // Long time on page
    if (step.timeOnPage > avgTimePerPage * 3) {
      bottlenecks.push({
        page: step.url,
        reason: 'long_time',
        impact: 'high',
        timeSpent: step.timeOnPage,
      });
    }
    
    // Errors on page
    if (step.errors && step.errors.length > 0) {
      bottlenecks.push({
        page: step.url,
        reason: 'errors',
        impact: 'high',
        timeSpent: step.timeOnPage,
      });
    }
    
    // Low engagement
    if (step.engagementScore < 30) {
      bottlenecks.push({
        page: step.url,
        reason: 'low_engagement',
        impact: 'medium',
        timeSpent: step.timeOnPage,
      });
    }
  });
  
  return bottlenecks;
};

// Method: Infer user intent
userJourneySchema.methods.inferIntent = function() {
  const signals = [];
  let primaryIntent = 'browse';
  let confidence = 50;
  
  // Analyze path patterns
  const hasProductPages = this.path.some(p => p.pageType === 'product');
  const hasCheckout = this.path.some(p => p.pageType === 'checkout');
  const hasSearch = this.path.some(p => p.entryMethod === 'search');
  const hasComparison = this.analysis.hasComparisonPath;
  
  if (hasCheckout) {
    primaryIntent = 'buy';
    confidence = 90;
    signals.push({ type: 'checkout_visit', weight: 0.9, reason: 'Visited checkout page' });
  } else if (hasComparison) {
    primaryIntent = 'compare';
    confidence = 75;
    signals.push({ type: 'comparison', weight: 0.75, reason: 'Compared multiple items' });
  } else if (hasSearch) {
    primaryIntent = 'search';
    confidence = 70;
    signals.push({ type: 'search_used', weight: 0.7, reason: 'Used search functionality' });
  } else if (hasProductPages) {
    primaryIntent = 'browse';
    confidence = 60;
    signals.push({ type: 'product_view', weight: 0.6, reason: 'Viewed products' });
  }
  
  return { primary: primaryIntent, confidence, signals };
};

// Static method: Get common paths
userJourneySchema.statics.getCommonPaths = async function(filters = {}, limit = 10) {
  return await this.aggregate([
    { $match: filters },
    {
      $project: {
        pathString: {
          $reduce: {
            input: '$path',
            initialValue: '',
            in: { $concat: ['$$value', ' -> ', '$$this.url'] }
          }
        }
      }
    },
    {
      $group: {
        _id: '$pathString',
        count: { $sum: 1 },
        avgDuration: { $avg: '$journey.duration' },
        conversionRate: { 
          $avg: { $cond: ['$journey.outcome.converted', 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// Static method: Get funnel analysis
userJourneySchema.statics.getFunnelAnalysis = async function(funnelName) {
  return await this.aggregate([
    { $match: { 'funnel.name': funnelName } },
    { $unwind: '$funnel.steps' },
    {
      $group: {
        _id: '$funnel.steps.name',
        totalUsers: { $sum: 1 },
        completedUsers: { 
          $sum: { $cond: ['$funnel.steps.completed', 1, 0] }
        },
        avgTimeToComplete: { $avg: '$funnel.steps.timeToComplete' },
        avgAttempts: { $avg: '$funnel.steps.attempts' },
      }
    },
    {
      $project: {
        stepName: '$_id',
        totalUsers: 1,
        completedUsers: 1,
        completionRate: { 
          $multiply: [{ $divide: ['$completedUsers', '$totalUsers'] }, 100]
        },
        dropOffRate: {
          $multiply: [{ $divide: [{ $subtract: ['$totalUsers', '$completedUsers'] }, '$totalUsers'] }, 100]
        },
        avgTimeToComplete: 1,
        avgAttempts: 1,
      }
    },
    { $sort: { totalUsers: -1 } }
  ]);
};

const UserJourney = mongoose.models.UserJourney || 
  mongoose.model("UserJourney", userJourneySchema, "userJourneys");

export default UserJourney;

