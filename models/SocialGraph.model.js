// models/SocialGraph.model.js
// Social graph - track who interacts with whom, influence, communities
import mongoose, { Schema } from "mongoose";

const socialGraphSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    
    // Node metrics (individual user)
    node: {
      // Centrality measures
      degreeCentrality: Number, // number of connections
      betweennessCentrality: Number, // bridge between communities
      closenessCentrality: Number, // how close to everyone
      eigenvectorCentrality: Number, // influence score
      
      // Activity
      totalInteractions: Number,
      incomingInteractions: Number,
      outgoingInteractions: Number,
      
      // Influence
      influenceScore: { type: Number, min: 0, max: 100, index: true },
      reachScore: Number, // potential audience size
      engagementRate: Number, // % of followers who engage
      
      // Reputation
      reputationScore: { type: Number, min: 0, max: 100 },
      trustScore: Number,
      expertiseAreas: [String],
    },
    
    // Connections (edges)
    connections: [{
      targetUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
      
      // Relationship type
      type: { 
        type: String, 
        enum: ['follower', 'following', 'mutual', 'blocked', 'muted'],
        required: true
      },
      
      // Strength
      strength: { type: Number, min: 0, max: 100 }, // connection strength
      
      // Interaction history
      interactions: {
        total: Number,
        likes: Number,
        comments: Number,
        shares: Number,
        messages: Number,
        mentions: Number,
        collaborations: Number,
      },
      
      // Timing
      connectedAt: Date,
      lastInteractionAt: Date,
      interactionFrequency: Number, // interactions per day
      
      // Reciprocity
      isReciprocal: Boolean,
      reciprocityScore: Number, // 0-100
      
      // Context
      connectionSource: String, // 'search', 'suggestion', 'mutual_friend', 'content'
      commonInterests: [String],
      mutualConnections: Number,
    }],
    
    // Communities/clusters
    communities: [{
      communityId: String,
      name: String,
      size: Number,
      
      // Membership
      role: String, // 'member', 'influencer', 'bridge', 'leader'
      joinedAt: Date,
      
      // Activity
      activityLevel: String, // 'low', 'medium', 'high'
      contributionScore: Number,
      
      // Connections within community
      internalConnections: Number,
      externalConnections: Number,
    }],
    
    // Interaction patterns
    patterns: {
      // Temporal patterns
      mostActiveHours: [Number], // hours of day (0-23)
      mostActiveDays: [String], // days of week
      
      // Interaction preferences
      preferredInteractionType: String, // 'likes', 'comments', 'shares'
      avgResponseTime: Number, // minutes
      
      // Content preferences
      preferredContentTypes: [String],
      preferredTopics: [String],
      
      // Behavior
      isLurker: Boolean, // consumes but doesn't interact
      isContributor: Boolean, // creates content
      isConnector: Boolean, // introduces people
      isInfluencer: Boolean, // high reach
    },
    
    // Follower analysis
    followers: {
      count: { type: Number, default: 0, index: true },
      
      // Growth
      growthRate: Number, // % per month
      newFollowersLast7Days: Number,
      newFollowersLast30Days: Number,
      unfollowersLast7Days: Number,
      unfollowersLast30Days: Number,
      
      // Quality
      avgFollowerInfluence: Number,
      avgFollowerEngagement: Number,
      botFollowerPercentage: Number,
      
      // Demographics
      topCountries: [{ country: String, count: Number }],
      topCities: [{ city: String, count: Number }],
      
      // Interests
      topInterests: [String],
      
      // Follower timeline
      timeline: [{
        date: Date,
        count: Number,
        change: Number,
      }],
    },
    
    // Following analysis
    following: {
      count: { type: Number, default: 0 },
      
      // Categories
      byType: [{
        type: String, // 'craftsman', 'brand', 'friend', 'celebrity'
        count: Number,
      }],
      
      // Engagement
      avgEngagementWithFollowing: Number,
      
      // Reciprocity
      mutualFollowCount: Number,
      mutualFollowRate: Number, // %
    },
    
    // Engagement metrics
    engagement: {
      // Received engagement
      totalLikesReceived: Number,
      totalCommentsReceived: Number,
      totalSharesReceived: Number,
      totalMentionsReceived: Number,
      
      // Given engagement
      totalLikesGiven: Number,
      totalCommentsGiven: Number,
      totalSharesGiven: Number,
      totalMentionsGiven: Number,
      
      // Rates
      avgLikesPerPost: Number,
      avgCommentsPerPost: Number,
      avgSharesPerPost: Number,
      
      // Engagement rate
      engagementRate: Number, // (likes + comments + shares) / followers
      
      // Virality
      viralityScore: Number, // 0-100
      viralPosts: Number,
    },
    
    // Content analysis
    content: {
      totalPosts: Number,
      totalComments: Number,
      totalShares: Number,
      
      // Frequency
      postsPerDay: Number,
      postsPerWeek: Number,
      
      // Performance
      avgPostReach: Number,
      avgPostEngagement: Number,
      bestPerformingPostId: String,
      
      // Topics
      topTopics: [{ topic: String, count: Number }],
      topHashtags: [{ hashtag: String, count: Number }],
    },
    
    // Network effects
    network: {
      // Reach
      firstDegreeReach: Number, // direct connections
      secondDegreeReach: Number, // friends of friends
      thirdDegreeReach: Number,
      
      // Clustering
      clusteringCoefficient: Number, // how connected your friends are
      
      // Diversity
      networkDiversity: Number, // 0-100, how diverse your network is
      
      // Strength
      strongTies: Number, // close connections
      weakTies: Number, // distant connections
      
      // Bridges
      isBridge: Boolean, // connects different communities
      bridgeScore: Number,
    },
    
    // Influence analysis
    influence: {
      // Overall influence
      score: { type: Number, min: 0, max: 100, index: true },
      tier: String, // 'nano', 'micro', 'macro', 'mega', 'celebrity'
      
      // Influence factors
      contentQuality: Number,
      consistency: Number,
      engagement: Number,
      reach: Number,
      authority: Number,
      
      // Influence areas
      topInfluenceAreas: [String],
      
      // Influence growth
      growthRate: Number, // % per month
      
      // Influence events
      influenceEvents: [{
        type: String, // 'viral_post', 'mention_by_influencer', 'featured'
        timestamp: Date,
        impact: Number,
      }],
    },
    
    // Recommendations
    recommendations: {
      // People to follow
      suggestedConnections: [{
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        reason: String, // 'mutual_friends', 'similar_interests', 'popular'
        score: Number,
      }],
      
      // Content to engage with
      suggestedContent: [{
        contentId: String,
        contentType: String,
        reason: String,
        score: Number,
      }],
      
      // Communities to join
      suggestedCommunities: [{
        communityId: String,
        name: String,
        reason: String,
        score: Number,
      }],
    },
    
    // Anomalies & risks
    anomalies: [{
      type: String, // 'sudden_follower_spike', 'bot_activity', 'spam_behavior'
      severity: String,
      detectedAt: Date,
      description: String,
      resolved: Boolean,
    }],
    
    // Privacy settings
    privacy: {
      profileVisibility: String, // 'public', 'private', 'friends'
      showFollowers: Boolean,
      showFollowing: Boolean,
      allowTagging: Boolean,
      allowMentions: Boolean,
    },
    
    // Last updated
    lastUpdated: { type: Date, default: Date.now, index: true },
    nextUpdateDue: Date,
  },
  { 
    timestamps: true,
  }
);

// Indexes
socialGraphSchema.index({ userId: 1 }, { unique: true });
socialGraphSchema.index({ 'node.influenceScore': -1 });
socialGraphSchema.index({ 'followers.count': -1 });
socialGraphSchema.index({ 'influence.score': -1 });
socialGraphSchema.index({ 'connections.targetUser': 1 });

// Method: Calculate influence score
socialGraphSchema.methods.calculateInfluenceScore = function() {
  let score = 0;
  
  // Follower count (0-30 points)
  const followerScore = Math.min((this.followers.count / 10000) * 30, 30);
  score += followerScore;
  
  // Engagement rate (0-30 points)
  score += (this.engagement.engagementRate || 0) * 0.3;
  
  // Content quality (0-20 points)
  score += (this.influence.contentQuality || 0) * 0.2;
  
  // Network centrality (0-20 points)
  score += (this.node.eigenvectorCentrality || 0) * 20;
  
  return Math.min(100, Math.round(score));
};

// Method: Calculate connection strength
socialGraphSchema.methods.calculateConnectionStrength = function(connection) {
  let strength = 0;
  
  // Interaction frequency (0-40 points)
  strength += Math.min(connection.interactionFrequency * 10, 40);
  
  // Interaction diversity (0-30 points)
  const interactionTypes = Object.values(connection.interactions).filter(v => v > 0).length;
  strength += interactionTypes * 5;
  
  // Reciprocity (0-20 points)
  if (connection.isReciprocal) strength += 20;
  
  // Recency (0-10 points)
  const daysSinceLastInteraction = (Date.now() - connection.lastInteractionAt) / (1000 * 60 * 60 * 24);
  if (daysSinceLastInteraction < 7) strength += 10;
  else if (daysSinceLastInteraction < 30) strength += 5;
  
  return Math.min(100, Math.round(strength));
};

// Method: Detect communities (Louvain algorithm simplified)
socialGraphSchema.methods.detectCommunities = async function() {
  // This would implement community detection algorithm
  // For now, return placeholder
  return [];
};

// Static method: Get influencers
socialGraphSchema.statics.getInfluencers = async function(limit = 100, minScore = 70) {
  return await this.find({
    'influence.score': { $gte: minScore }
  })
  .sort({ 'influence.score': -1 })
  .limit(limit)
  .populate('userId', 'name profilePicture')
  .lean();
};

// Static method: Get network statistics
socialGraphSchema.statics.getNetworkStatistics = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalConnections: { $sum: '$node.degreeCentrality' },
        avgConnections: { $avg: '$node.degreeCentrality' },
        avgInfluence: { $avg: '$influence.score' },
        totalCommunities: { $sum: { $size: '$communities' } },
      }
    }
  ]);
};

// Static method: Find connection path between two users
socialGraphSchema.statics.findConnectionPath = async function(userId1, userId2, maxDepth = 3) {
  // This would implement BFS/DFS to find shortest path
  // Placeholder for now
  return [];
};

const SocialGraph = mongoose.models.SocialGraph || 
  mongoose.model("SocialGraph", socialGraphSchema, "socialGraphs");

export default SocialGraph;
