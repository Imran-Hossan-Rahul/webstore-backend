// models/SearchAnalytics.model.js
// Search analytics - queries, results, clicks, refinements, zero-results
import mongoose, { Schema } from "mongoose";

const searchAnalyticsSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true },
    
    // Search query
    query: {
      original: { type: String, required: true, index: 'text' },
      normalized: String, // lowercase, trimmed
      tokens: [String], // individual words
      language: String, // detected language
      
      // Query characteristics
      length: Number, // character count
      wordCount: Number,
      hasSpecialChars: Boolean,
      hasNumbers: Boolean,
      
      // Query type
      type: { 
        type: String, 
        enum: ['keyword', 'phrase', 'question', 'command', 'filter'],
        index: true
      },
      
      // Intent (inferred)
      intent: { 
        type: String, 
        enum: ['informational', 'navigational', 'transactional', 'commercial'],
        index: true
      },
      intentConfidence: Number, // 0-100
    },
    
    // Search context
    context: {
      timestamp: { type: Date, default: Date.now, index: true },
      
      // Search location
      searchBox: String, // 'header', 'sidebar', 'inline', 'modal'
      searchType: String, // 'site_search', 'product_search', 'content_search'
      
      // Previous context
      previousPage: String,
      previousQuery: String,
      isRefinement: Boolean, // refined from previous search
      refinementType: String, // 'added_term', 'removed_term', 'replaced_term', 'filter_added'
      
      // Filters applied
      filters: [{
        type: String, // 'category', 'price', 'date', 'rating'
        value: Schema.Types.Mixed,
      }],
      
      // Sorting
      sortBy: String,
      sortOrder: String, // 'asc', 'desc'
    },
    
    // Search results
    results: {
      // Result count
      totalResults: { type: Number, index: true },
      displayedResults: Number,
      
      // Zero results
      hasZeroResults: { type: Boolean, index: true },
      
      // Result quality
      relevanceScore: Number, // 0-100, average relevance
      
      // Results shown
      items: [{
        id: String,
        title: String,
        type: String, // 'product', 'codex', 'user', 'page'
        position: Number, // 1-based position in results
        relevanceScore: Number,
        
        // Interaction
        viewed: Boolean,
        clicked: Boolean,
        clickedAt: Date,
        timeToClick: Number, // ms from results shown
        
        // Dwell time
        dwellTime: Number, // ms spent on result page
        bounced: Boolean, // returned to search quickly
      }],
      
      // Pagination
      page: Number,
      pageSize: Number,
      totalPages: Number,
      
      // Load time
      loadTime: Number, // milliseconds
    },
    
    // User interaction
    interaction: {
      // Click behavior
      clickedResults: Number,
      clickPosition: [Number], // positions of clicked results
      firstClickPosition: Number,
      lastClickPosition: Number,
      
      // Click-through rate
      ctr: Number, // 0-100
      
      // Dwell time
      avgDwellTime: Number, // ms
      totalDwellTime: Number,
      
      // Refinement
      refined: Boolean,
      refinementCount: Number,
      refinements: [{
        newQuery: String,
        timestamp: Date,
        reason: String, // 'no_results', 'poor_results', 'exploring'
      }],
      
      // Abandonment
      abandoned: Boolean,
      abandonedAt: Date,
      abandonmentReason: String,
      
      // Conversion
      converted: Boolean,
      convertedAt: Date,
      conversionType: String, // 'purchase', 'signup', 'download'
      conversionValue: Number,
      
      // Satisfaction (inferred)
      satisfactionScore: Number, // 0-100
      likelySatisfied: Boolean,
    },
    
    // Search session
    searchSession: {
      // Session ID for related searches
      searchSessionId: String,
      
      // Position in session
      searchNumber: Number, // 1st, 2nd, 3rd search in session
      
      // Session metrics
      totalSearches: Number,
      totalClicks: Number,
      totalRefinements: Number,
      sessionDuration: Number, // ms
      
      // Session outcome
      sessionConverted: Boolean,
      sessionAbandoned: Boolean,
    },
    
    // Autocomplete/suggestions
    autocomplete: {
      used: Boolean,
      suggestionsShown: [String],
      suggestionSelected: String,
      suggestionPosition: Number,
      
      // Typing behavior
      typingSpeed: Number, // WPM
      pauseCount: Number,
      backspaceCount: Number,
    },
    
    // Spelling & corrections
    spelling: {
      hasMisspelling: Boolean,
      correctedQuery: String,
      correctionAccepted: Boolean,
      
      // Did you mean
      didYouMeanShown: Boolean,
      didYouMeanQuery: String,
      didYouMeanClicked: Boolean,
    },
    
    // Related searches
    relatedSearches: {
      shown: [String],
      clicked: String,
      clickedAt: Date,
    },
    
    // Facets/filters
    facets: [{
      name: String,
      type: String,
      values: [String],
      
      // Interaction
      expanded: Boolean,
      selected: [String],
      
      // Impact
      resultsBeforeFilter: Number,
      resultsAfterFilter: Number,
    }],
    
    // Performance
    performance: {
      // Query time
      queryTime: Number, // ms
      
      // Rendering time
      renderTime: Number,
      
      // Total time
      totalTime: Number,
      
      // Cache hit
      cacheHit: Boolean,
      
      // Index used
      indexUsed: String,
    },
    
    // Device & context
    device: {
      type: String,
      browser: String,
      os: String,
      screenSize: String,
      
      // Input method
      inputMethod: String, // 'keyboard', 'voice', 'paste'
      
      // Voice search
      isVoiceSearch: Boolean,
      voiceConfidence: Number,
    },
    
    // A/B test variant
    experiment: {
      testId: { type: Schema.Types.ObjectId, ref: 'ABTest' },
      variantId: String,
      variantName: String,
    },
    
    // Quality indicators
    quality: {
      // Result quality
      hasRelevantResults: Boolean,
      hasHighQualityResults: Boolean,
      
      // User satisfaction signals
      quickClick: Boolean, // clicked within 3s
      longDwell: Boolean, // stayed on result >30s
      noRefinement: Boolean, // didn't refine search
      
      // Negative signals
      pogo_sticking: Boolean, // clicked multiple results quickly
      immediateRefinement: Boolean, // refined within 10s
      zeroClicks: Boolean, // no results clicked
    },
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
searchAnalyticsSchema.index({ 'query.original': 'text' });
searchAnalyticsSchema.index({ 'query.normalized': 1 });
searchAnalyticsSchema.index({ sessionId: 1, 'context.timestamp': 1 });
searchAnalyticsSchema.index({ userId: 1, 'context.timestamp': -1 });
searchAnalyticsSchema.index({ 'results.hasZeroResults': 1 });
searchAnalyticsSchema.index({ 'interaction.converted': 1 });
searchAnalyticsSchema.index({ 'query.type': 1 });
searchAnalyticsSchema.index({ 'query.intent': 1 });

// Method: Calculate satisfaction score
searchAnalyticsSchema.methods.calculateSatisfactionScore = function() {
  let score = 50; // baseline
  
  // Positive signals
  if (this.interaction.clickedResults > 0) score += 20;
  if (this.interaction.avgDwellTime > 30000) score += 15; // >30s dwell
  if (!this.interaction.refined) score += 10;
  if (this.interaction.converted) score += 20;
  if (this.quality.quickClick) score += 10;
  
  // Negative signals
  if (this.results.hasZeroResults) score -= 40;
  if (this.interaction.abandoned) score -= 20;
  if (this.quality.pogo_sticking) score -= 15;
  if (this.quality.immediateRefinement) score -= 10;
  if (this.quality.zeroClicks) score -= 15;
  
  return Math.max(0, Math.min(100, score));
};

// Method: Infer search intent
searchAnalyticsSchema.methods.inferIntent = function() {
  const query = this.query.original.toLowerCase();
  
  // Question words = informational
  if (/^(what|why|how|when|where|who|which)/.test(query)) {
    return { intent: 'informational', confidence: 80 };
  }
  
  // Buy/purchase words = transactional
  if (/(buy|purchase|order|price|cheap|discount|deal)/.test(query)) {
    return { intent: 'transactional', confidence: 85 };
  }
  
  // Comparison words = commercial
  if (/(best|top|review|compare|vs|versus)/.test(query)) {
    return { intent: 'commercial', confidence: 75 };
  }
  
  // Brand/specific page = navigational
  if (this.results.totalResults === 1 || /^(login|signup|contact|about)/.test(query)) {
    return { intent: 'navigational', confidence: 70 };
  }
  
  return { intent: 'informational', confidence: 50 };
};

// Static method: Get popular searches
searchAnalyticsSchema.statics.getPopularSearches = async function(limit = 10, timeRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  return await this.aggregate([
    { $match: { 'context.timestamp': { $gte: startDate } } },
    {
      $group: {
        _id: '$query.normalized',
        count: { $sum: 1 },
        avgResults: { $avg: '$results.totalResults' },
        clicks: { $sum: { $cond: [{ $gt: ['$interaction.clickedResults', 0] }, 1, 0] } },
        conversions: { $sum: { $cond: ['$interaction.converted', 1, 0] } },
        zeroResults: { $sum: { $cond: ['$results.hasZeroResults', 1, 0] } },
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// Static method: Get zero-result queries
searchAnalyticsSchema.statics.getZeroResultQueries = async function(limit = 100) {
  return await this.aggregate([
    { $match: { 'results.hasZeroResults': true } },
    {
      $group: {
        _id: '$query.normalized',
        count: { $sum: 1 },
        lastSearched: { $max: '$context.timestamp' },
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// Static method: Get search funnel
searchAnalyticsSchema.statics.getSearchFunnel = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        withResults: { 
          $sum: { $cond: [{ $gt: ['$results.totalResults', 0] }, 1, 0] }
        },
        withClicks: {
          $sum: { $cond: [{ $gt: ['$interaction.clickedResults', 0] }, 1, 0] }
        },
        withConversions: {
          $sum: { $cond: ['$interaction.converted', 1, 0] }
        },
      }
    },
    {
      $project: {
        totalSearches: 1,
        withResults: 1,
        withClicks: 1,
        withConversions: 1,
        resultsRate: {
          $multiply: [{ $divide: ['$withResults', '$totalSearches'] }, 100]
        },
        ctrRate: {
          $multiply: [{ $divide: ['$withClicks', '$totalSearches'] }, 100]
        },
        conversionRate: {
          $multiply: [{ $divide: ['$withConversions', '$totalSearches'] }, 100]
        },
      }
    }
  ]);
};

const SearchAnalytics = mongoose.models.SearchAnalytics || 
  mongoose.model("SearchAnalytics", searchAnalyticsSchema, "searchAnalytics");

export default SearchAnalytics;

