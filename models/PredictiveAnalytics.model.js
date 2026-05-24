// models/PredictiveAnalytics.model.js
// ML-powered predictive analytics - churn, conversion, LTV prediction
import mongoose, { Schema } from "mongoose";

const predictiveAnalyticsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    visitorId: { type: String, index: true },
    
    // Last updated
    lastUpdated: { type: Date, default: Date.now, index: true },
    nextUpdateDue: Date,
    
    // Churn Prediction
    churn: {
      // Prediction
      score: { type: Number, min: 0, max: 100, index: true }, // 0 = won't churn, 100 = will churn
      risk: { 
        type: String, 
        enum: ['very_low', 'low', 'medium', 'high', 'critical'],
        index: true
      },
      
      // Probability
      probability: Number, // 0-1
      confidence: Number, // 0-100, model confidence
      
      // Timing
      predictedChurnDate: Date,
      daysUntilChurn: Number,
      
      // Factors (what's driving the prediction)
      factors: [{
        name: String,
        impact: Number, // -1 to 1, negative = increases churn risk
        weight: Number, // 0-1, importance
        value: Schema.Types.Mixed,
        description: String,
      }],
      
      // Top risk factors
      topRiskFactors: [{
        factor: String,
        severity: String, // 'low', 'medium', 'high'
        description: String,
      }],
      
      // Historical predictions
      history: [{
        date: Date,
        score: Number,
        risk: String,
      }],
      
      // Interventions
      recommendedActions: [{
        action: String,
        priority: String, // 'low', 'medium', 'high', 'urgent'
        expectedImpact: Number, // % reduction in churn risk
        description: String,
      }],
    },
    
    // Conversion Prediction
    conversion: {
      // Overall conversion likelihood
      score: { type: Number, min: 0, max: 100, index: true },
      likelihood: { 
        type: String, 
        enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
        index: true
      },
      
      // Probability
      probability: Number, // 0-1
      confidence: Number,
      
      // Timing
      predictedConversionDate: Date,
      daysUntilConversion: Number,
      
      // Conversion type predictions
      byType: [{
        type: String, // 'purchase', 'signup', 'trial', 'upgrade'
        score: Number,
        probability: Number,
        predictedDate: Date,
      }],
      
      // Factors
      factors: [{
        name: String,
        impact: Number, // -1 to 1, positive = increases conversion
        weight: Number,
        value: Schema.Types.Mixed,
        description: String,
      }],
      
      // Barriers to conversion
      barriers: [{
        barrier: String,
        severity: String,
        description: String,
        solution: String,
      }],
      
      // Recommended actions
      recommendedActions: [{
        action: String,
        priority: String,
        expectedImpact: Number, // % increase in conversion probability
        description: String,
      }],
    },
    
    // Lifetime Value (LTV) Prediction
    ltv: {
      // Predicted LTV
      predicted: { type: Number, index: true },
      currency: { type: String, default: 'USD' },
      
      // Confidence interval
      lower: Number, // 95% CI lower bound
      upper: Number, // 95% CI upper bound
      confidence: Number,
      
      // Time horizon
      timeHorizon: Number, // days
      
      // Breakdown
      breakdown: {
        firstPurchase: Number,
        repeatPurchases: Number,
        subscriptions: Number,
        upsells: Number,
        referrals: Number,
      },
      
      // Comparison
      vsAverage: Number, // % difference from average user
      percentile: Number, // 0-100, where this user ranks
      segment: String, // 'low_value', 'medium_value', 'high_value', 'vip'
      
      // Factors
      factors: [{
        name: String,
        impact: Number,
        weight: Number,
        value: Schema.Types.Mixed,
      }],
      
      // Growth potential
      growthPotential: {
        score: Number, // 0-100
        maxPotentialLTV: Number,
        gapToMax: Number,
        actions: [String],
      },
    },
    
    // Engagement Prediction
    engagement: {
      // Next 30 days engagement score
      predictedScore: { type: Number, min: 0, max: 100 },
      trend: { 
        type: String, 
        enum: ['increasing', 'stable', 'decreasing', 'volatile']
      },
      
      // Activity predictions
      predictedSessions: Number,
      predictedPageViews: Number,
      predictedTimeSpent: Number, // minutes
      
      // Feature usage predictions
      predictedFeatureUsage: [{
        feature: String,
        usageProbability: Number,
        expectedFrequency: Number,
      }],
      
      // Engagement risk
      disengagementRisk: {
        score: Number,
        risk: String,
        factors: [String],
      },
    },
    
    // Purchase Prediction
    purchase: {
      // Next purchase
      nextPurchase: {
        probability: Number,
        predictedDate: Date,
        daysUntilPurchase: Number,
        predictedValue: Number,
        confidence: Number,
      },
      
      // Product recommendations
      likelyProducts: [{
        productId: String,
        productName: String,
        probability: Number,
        predictedValue: Number,
        reason: String,
      }],
      
      // Purchase patterns
      patterns: {
        avgDaysBetweenPurchases: Number,
        preferredDayOfWeek: String,
        preferredTimeOfDay: String,
        seasonality: String,
      },
      
      // Upsell/cross-sell opportunities
      opportunities: [{
        type: String, // 'upsell', 'cross_sell', 'bundle'
        products: [String],
        probability: Number,
        expectedValue: Number,
        timing: String,
      }],
    },
    
    // Behavior Prediction
    behavior: {
      // Next actions
      likelyNextActions: [{
        action: String,
        probability: Number,
        timing: String, // 'immediate', 'short_term', 'long_term'
        context: String,
      }],
      
      // Browsing patterns
      predictedBrowsingPattern: {
        pagesPerSession: Number,
        avgSessionDuration: Number,
        preferredCategories: [String],
        preferredDevices: [String],
      },
      
      // Response to marketing
      marketingResponse: {
        emailOpenRate: Number,
        emailClickRate: Number,
        pushNotificationResponse: Number,
        adResponseRate: Number,
        bestChannel: String,
        bestTime: String,
      },
    },
    
    // Segmentation
    segments: {
      // Behavioral segments
      behavioral: [String], // 'power_user', 'casual_user', 'at_risk', 'dormant'
      
      // Value segments
      value: String, // 'high_value', 'medium_value', 'low_value'
      
      // Lifecycle stage
      lifecycle: String, // 'new', 'active', 'engaged', 'at_risk', 'churned', 'reactivated'
      
      // Persona
      persona: String, // 'researcher', 'impulse_buyer', 'bargain_hunter', 'loyal_customer'
      
      // Custom segments
      custom: [String],
    },
    
    // Model Information
    models: {
      // Churn model
      churn: {
        version: String,
        algorithm: String, // 'random_forest', 'xgboost', 'neural_network'
        trainedOn: Date,
        accuracy: Number,
        precision: Number,
        recall: Number,
        f1Score: Number,
      },
      
      // Conversion model
      conversion: {
        version: String,
        algorithm: String,
        trainedOn: Date,
        accuracy: Number,
        auc: Number, // Area Under Curve
      },
      
      // LTV model
      ltv: {
        version: String,
        algorithm: String,
        trainedOn: Date,
        mae: Number, // Mean Absolute Error
        rmse: Number, // Root Mean Squared Error
        r2: Number, // R-squared
      },
    },
    
    // Feature Importance (what drives predictions)
    featureImportance: [{
      feature: String,
      importance: Number, // 0-1
      category: String, // 'demographic', 'behavioral', 'transactional', 'engagement'
    }],
    
    // Anomalies
    anomalies: [{
      type: String,
      severity: String,
      description: String,
      detectedAt: Date,
      resolved: Boolean,
    }],
    
    // Recommendations (personalized)
    recommendations: {
      // Content recommendations
      content: [{
        type: String, // 'codex', 'product', 'video', 'course'
        id: String,
        title: String,
        score: Number,
        reason: String,
      }],
      
      // Action recommendations
      actions: [{
        action: String,
        priority: String,
        expectedOutcome: String,
        timing: String,
      }],
      
      // Offers
      offers: [{
        type: String, // 'discount', 'free_trial', 'upgrade', 'bundle'
        value: Number,
        probability: Number, // probability of acceptance
        expectedROI: Number,
      }],
    },
    
    // Confidence & Quality
    quality: {
      overallConfidence: Number, // 0-100
      dataCompleteness: Number, // 0-100
      predictionReliability: String, // 'low', 'medium', 'high'
      
      // Data quality issues
      issues: [{
        type: String,
        severity: String,
        description: String,
      }],
    },
  },
  { 
    timestamps: true,
  }
);

// Indexes
predictiveAnalyticsSchema.index({ userId: 1 }, { unique: true });
predictiveAnalyticsSchema.index({ 'churn.score': -1 });
predictiveAnalyticsSchema.index({ 'churn.risk': 1 });
predictiveAnalyticsSchema.index({ 'conversion.score': -1 });
predictiveAnalyticsSchema.index({ 'ltv.predicted': -1 });
predictiveAnalyticsSchema.index({ 'ltv.segment': 1 });
predictiveAnalyticsSchema.index({ 'segments.lifecycle': 1 });
predictiveAnalyticsSchema.index({ lastUpdated: -1 });

// Method: Calculate overall risk score
predictiveAnalyticsSchema.methods.calculateOverallRisk = function() {
  const churnWeight = 0.4;
  const conversionWeight = 0.3;
  const engagementWeight = 0.3;
  
  const churnRisk = this.churn.score || 0;
  const conversionRisk = 100 - (this.conversion.score || 50);
  const engagementRisk = this.engagement.disengagementRisk?.score || 0;
  
  return Math.round(
    churnRisk * churnWeight +
    conversionRisk * conversionWeight +
    engagementRisk * engagementWeight
  );
};

// Method: Get priority actions
predictiveAnalyticsSchema.methods.getPriorityActions = function() {
  const actions = [];
  
  // Churn prevention actions
  if (this.churn.score >= 70) {
    actions.push(...this.churn.recommendedActions.filter(a => a.priority === 'urgent' || a.priority === 'high'));
  }
  
  // Conversion actions
  if (this.conversion.score >= 60) {
    actions.push(...this.conversion.recommendedActions.filter(a => a.priority === 'high'));
  }
  
  // Sort by expected impact
  return actions.sort((a, b) => (b.expectedImpact || 0) - (a.expectedImpact || 0)).slice(0, 5);
};

// Method: Should update predictions?
predictiveAnalyticsSchema.methods.shouldUpdate = function() {
  if (!this.nextUpdateDue) return true;
  return new Date() >= this.nextUpdateDue;
};

// Static method: Get high-risk users
predictiveAnalyticsSchema.statics.getHighRiskUsers = async function(limit = 100) {
  return await this.find({
    'churn.risk': { $in: ['high', 'critical'] }
  })
  .sort({ 'churn.score': -1 })
  .limit(limit)
  .populate('userId', 'name email')
  .lean();
};

// Static method: Get high-value opportunities
predictiveAnalyticsSchema.statics.getHighValueOpportunities = async function(limit = 100) {
  return await this.find({
    'conversion.score': { $gte: 70 },
    'ltv.predicted': { $gte: 1000 }
  })
  .sort({ 'ltv.predicted': -1 })
  .limit(limit)
  .populate('userId', 'name email')
  .lean();
};

// Static method: Get segment distribution
predictiveAnalyticsSchema.statics.getSegmentDistribution = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: '$segments.lifecycle',
        count: { $sum: 1 },
        avgLTV: { $avg: '$ltv.predicted' },
        avgChurnRisk: { $avg: '$churn.score' },
        avgConversionScore: { $avg: '$conversion.score' },
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const PredictiveAnalytics = mongoose.models.PredictiveAnalytics || 
  mongoose.model("PredictiveAnalytics", predictiveAnalyticsSchema, "predictiveAnalytics");

export default PredictiveAnalytics;

