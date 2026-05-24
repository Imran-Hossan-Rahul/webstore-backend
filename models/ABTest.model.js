// models/ABTest.model.js
// A/B Testing & Experimentation Framework
import mongoose, { Schema } from "mongoose";

const abTestSchema = new Schema(
  {
    // Test metadata
    name: { type: String, required: true, index: true },
    description: String,
    hypothesis: String, // what you're testing
    
    // Status
    status: { 
      type: String, 
      enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'archived'],
      default: 'draft',
      index: true
    },
    
    // Timing
    schedule: {
      startDate: { type: Date, index: true },
      endDate: Date,
      duration: Number, // planned duration in days
      actualStartDate: Date,
      actualEndDate: Date,
      actualDuration: Number,
    },
    
    // Test type
    testType: { 
      type: String, 
      enum: ['ab', 'multivariate', 'split_url', 'redirect', 'personalization'],
      default: 'ab'
    },
    
    // Variants
    variants: [{
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      description: String,
      
      // Traffic allocation
      trafficAllocation: { type: Number, min: 0, max: 100, default: 50 }, // percentage
      
      // Changes
      changes: [{
        type: String, // 'element', 'css', 'js', 'redirect', 'content'
        selector: String, // CSS selector
        attribute: String,
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        code: String, // custom JS/CSS
      }],
      
      // Metrics
      metrics: {
        // Participants
        totalUsers: { type: Number, default: 0 },
        uniqueUsers: { type: Number, default: 0 },
        returningUsers: { type: Number, default: 0 },
        
        // Engagement
        avgSessionDuration: Number,
        avgPageViews: Number,
        avgEngagementScore: Number,
        bounceRate: Number,
        
        // Conversions
        conversions: { type: Number, default: 0 },
        conversionRate: Number,
        conversionValue: Number,
        avgConversionValue: Number,
        
        // Revenue
        totalRevenue: Number,
        avgRevenuePerUser: Number,
        
        // Goals
        goalCompletions: [{
          goalName: String,
          completions: Number,
          completionRate: Number,
        }],
        
        // Micro-conversions
        microConversions: [{
          name: String,
          count: Number,
        }],
      },
      
      // Statistical significance
      statistics: {
        sampleSize: Number,
        confidenceLevel: Number, // 0-100
        pValue: Number,
        zScore: Number,
        isSignificant: Boolean,
        
        // Compared to control
        improvement: Number, // percentage
        improvementLower: Number, // confidence interval lower bound
        improvementUpper: Number, // confidence interval upper bound
      },
      
      // Performance
      performance: {
        avgLoadTime: Number,
        avgTTFB: Number,
        avgFCP: Number,
        avgLCP: Number,
        avgCLS: Number,
      },
      
      // User feedback
      feedback: {
        positiveCount: Number,
        negativeCount: Number,
        neutralCount: Number,
        avgRating: Number,
        comments: [{
          text: String,
          sentiment: String, // 'positive', 'negative', 'neutral'
          timestamp: Date,
        }],
      },
    }],
    
    // Control variant (baseline)
    controlVariantId: { type: String, required: true },
    
    // Targeting
    targeting: {
      // URL targeting
      urls: [{
        type: String, // 'exact', 'contains', 'regex', 'starts_with', 'ends_with'
        value: String,
      }],
      
      // Audience targeting
      audience: {
        // User attributes
        userTypes: [String], // 'new', 'returning', 'logged_in', 'guest'
        countries: [String],
        cities: [String],
        languages: [String],
        
        // Device
        devices: [String], // 'mobile', 'desktop', 'tablet'
        browsers: [String],
        os: [String],
        
        // Behavior
        minPageViews: Number,
        maxPageViews: Number,
        minSessionDuration: Number,
        hasConvertedBefore: Boolean,
        
        // Custom segments
        segments: [String],
        
        // Traffic percentage
        trafficPercentage: { type: Number, min: 0, max: 100, default: 100 },
      },
      
      // Exclusions
      exclusions: {
        userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        ips: [String],
        bots: Boolean,
      },
    },
    
    // Goals (what you're measuring)
    goals: [{
      name: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['pageview', 'click', 'form_submit', 'purchase', 'signup', 'custom_event'],
        required: true
      },
      
      // Goal definition
      target: Schema.Types.Mixed, // URL, selector, event name, etc.
      value: Number, // monetary value
      
      // Priority
      isPrimary: Boolean,
      weight: Number, // for multi-goal optimization
      
      // Tracking
      totalCompletions: { type: Number, default: 0 },
      completionsByVariant: Schema.Types.Mixed,
    }],
    
    // Metrics to track
    metrics: {
      primary: String, // 'conversion_rate', 'revenue', 'engagement'
      secondary: [String],
      
      // Custom metrics
      custom: [{
        name: String,
        formula: String, // JS formula
        unit: String,
      }],
    },
    
    // Results
    results: {
      // Winner
      winnerVariantId: String,
      winnerConfidence: Number, // 0-100
      winnerDeclaredAt: Date,
      
      // Overall statistics
      totalParticipants: { type: Number, default: 0 },
      totalConversions: { type: Number, default: 0 },
      overallConversionRate: Number,
      
      // Statistical analysis
      hasSignificantResult: Boolean,
      confidenceLevel: Number,
      requiredSampleSize: Number,
      currentSampleSize: Number,
      progressPercentage: Number,
      
      // Estimated time to significance
      estimatedDaysToSignificance: Number,
      
      // Recommendations
      recommendation: String, // 'deploy_winner', 'continue_test', 'stop_test', 'inconclusive'
      recommendationReason: String,
    },
    
    // Timeline
    timeline: [{
      timestamp: Date,
      event: String, // 'created', 'started', 'paused', 'resumed', 'completed', 'winner_declared'
      details: String,
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
    }],
    
    // Settings
    settings: {
      // Traffic distribution
      trafficDistribution: String, // 'equal', 'weighted', 'dynamic'
      
      // Auto-optimization
      autoOptimize: Boolean, // automatically shift traffic to winning variant
      optimizationThreshold: Number, // confidence level to start optimization
      
      // Auto-stop
      autoStop: Boolean, // stop test when significance reached
      autoStopThreshold: Number, // confidence level to stop
      
      // Sample size
      minSampleSize: Number,
      maxSampleSize: Number,
      
      // Duration
      minDuration: Number, // days
      maxDuration: Number,
      
      // Quality
      excludeBots: Boolean,
      excludeInternalTraffic: Boolean,
      cookieDuration: Number, // days to remember variant assignment
    },
    
    // Integration
    integration: {
      // Analytics
      googleAnalytics: {
        enabled: Boolean,
        experimentId: String,
      },
      
      // Tag manager
      gtm: {
        enabled: Boolean,
        containerId: String,
      },
      
      // Webhooks
      webhooks: [{
        event: String, // 'test_started', 'test_completed', 'winner_declared'
        url: String,
        enabled: Boolean,
      }],
    },
    
    // Metadata
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    
    tags: [String],
    notes: String,
  },
  { 
    timestamps: true,
  }
);

// Indexes
abTestSchema.index({ name: 1 });
abTestSchema.index({ status: 1 });
abTestSchema.index({ 'schedule.startDate': -1 });
abTestSchema.index({ createdBy: 1 });
abTestSchema.index({ tags: 1 });

// Method: Assign variant to user
abTestSchema.methods.assignVariant = function(userId, visitorId) {
  // Check if user is excluded
  if (this.targeting.exclusions.userIds.includes(userId)) {
    return null;
  }
  
  // Deterministic assignment based on user/visitor ID
  const hash = require('crypto')
    .createHash('md5')
    .update(`${this._id}-${userId || visitorId}`)
    .digest('hex');
  
  const hashValue = parseInt(hash.substring(0, 8), 16);
  const percentage = (hashValue % 100) + 1;
  
  // Find variant based on traffic allocation
  let cumulativeAllocation = 0;
  for (const variant of this.variants) {
    cumulativeAllocation += variant.trafficAllocation;
    if (percentage <= cumulativeAllocation) {
      return variant.id;
    }
  }
  
  // Fallback to control
  return this.controlVariantId;
};

// Method: Record conversion
abTestSchema.methods.recordConversion = async function(variantId, value = 0) {
  const variant = this.variants.find(v => v.id === variantId);
  if (!variant) return;
  
  variant.metrics.conversions += 1;
  variant.metrics.conversionValue = (variant.metrics.conversionValue || 0) + value;
  variant.metrics.conversionRate = (variant.metrics.conversions / variant.metrics.totalUsers) * 100;
  variant.metrics.avgConversionValue = variant.metrics.conversionValue / variant.metrics.conversions;
  
  this.results.totalConversions += 1;
  this.results.overallConversionRate = (this.results.totalConversions / this.results.totalParticipants) * 100;
  
  await this.save();
  
  // Check if significance reached
  await this.checkSignificance();
};

// Method: Check statistical significance
abTestSchema.methods.checkSignificance = async function() {
  const control = this.variants.find(v => v.id === this.controlVariantId);
  if (!control) return;
  
  for (const variant of this.variants) {
    if (variant.id === this.controlVariantId) continue;
    
    // Calculate z-score and p-value
    const p1 = control.metrics.conversionRate / 100;
    const p2 = variant.metrics.conversionRate / 100;
    const n1 = control.metrics.totalUsers;
    const n2 = variant.metrics.totalUsers;
    
    if (n1 < 100 || n2 < 100) continue; // need minimum sample size
    
    const pooledP = (control.metrics.conversions + variant.metrics.conversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    const zScore = (p2 - p1) / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
    
    variant.statistics.zScore = zScore;
    variant.statistics.pValue = pValue;
    variant.statistics.isSignificant = pValue < 0.05; // 95% confidence
    variant.statistics.confidenceLevel = (1 - pValue) * 100;
    variant.statistics.improvement = ((p2 - p1) / p1) * 100;
    
    // Confidence interval
    const marginOfError = 1.96 * se; // 95% CI
    variant.statistics.improvementLower = ((p2 - marginOfError - p1) / p1) * 100;
    variant.statistics.improvementUpper = ((p2 + marginOfError - p1) / p1) * 100;
  }
  
  await this.save();
  
  // Determine winner if auto-stop enabled
  if (this.settings.autoStop) {
    await this.determineWinner();
  }
};

// Method: Determine winner
abTestSchema.methods.determineWinner = async function() {
  const significantVariants = this.variants.filter(v => 
    v.statistics.isSignificant && 
    v.statistics.confidenceLevel >= (this.settings.autoStopThreshold || 95)
  );
  
  if (significantVariants.length === 0) {
    this.results.recommendation = 'continue_test';
    this.results.recommendationReason = 'No statistically significant results yet';
    await this.save();
    return;
  }
  
  // Find best performing variant
  const winner = significantVariants.reduce((best, current) => 
    current.metrics.conversionRate > best.metrics.conversionRate ? current : best
  );
  
  this.results.winnerVariantId = winner.id;
  this.results.winnerConfidence = winner.statistics.confidenceLevel;
  this.results.winnerDeclaredAt = new Date();
  this.results.hasSignificantResult = true;
  this.results.recommendation = 'deploy_winner';
  this.results.recommendationReason = `Variant "${winner.name}" shows ${winner.statistics.improvement.toFixed(2)}% improvement with ${winner.statistics.confidenceLevel.toFixed(1)}% confidence`;
  
  this.status = 'completed';
  
  this.timeline.push({
    timestamp: new Date(),
    event: 'winner_declared',
    details: `Winner: ${winner.name}`,
  });
  
  await this.save();
};

// Helper: Normal CDF (for p-value calculation)
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

// Static method: Get active tests for URL
abTestSchema.statics.getActiveTestsForUrl = async function(url) {
  return await this.find({
    status: 'running',
    'targeting.urls': {
      $elemMatch: {
        $or: [
          { type: 'exact', value: url },
          { type: 'contains', value: { $regex: url } },
          { type: 'starts_with', value: { $regex: `^${url}` } },
        ]
      }
    }
  });
};

const ABTest = mongoose.models.ABTest || 
  mongoose.model("ABTest", abTestSchema, "abTests");

export default ABTest;
