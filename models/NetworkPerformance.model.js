// models/NetworkPerformance.model.js
// Network performance monitoring - speed, latency, quality, reliability
import mongoose, { Schema } from "mongoose";

const networkPerformanceSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true },
    
    // Connection info (from Navigator.connection API)
    connection: {
      effectiveType: { 
        type: String, 
        enum: ['slow-2g', '2g', '3g', '4g', '5g', 'unknown'],
        index: true
      },
      type: { 
        type: String, 
        enum: ['bluetooth', 'cellular', 'ethernet', 'wifi', 'wimax', 'none', 'other', 'unknown']
      },
      downlink: { type: Number }, // Mbps
      downlinkMax: { type: Number }, // Mbps (theoretical max)
      rtt: { type: Number }, // Round-trip time in ms
      saveData: { type: Boolean }, // data saver mode enabled
    },
    
    // Speed tests (actual measurements)
    speedTests: [{
      timestamp: Date,
      method: String, // 'resource_timing', 'ping', 'download_test'
      
      // Download speed
      downloadSpeedMbps: Number,
      downloadSpeedKbps: Number,
      
      // Upload speed (if measured)
      uploadSpeedMbps: Number,
      uploadSpeedKbps: Number,
      
      // Latency
      latencyMs: Number,
      jitterMs: Number, // latency variation
      
      // Test details
      testDuration: Number, // ms
      bytesTransferred: Number,
      testUrl: String,
      testResult: String, // 'success', 'failed', 'timeout'
    }],
    
    // Resource timing (from Performance API)
    resourceTimings: [{
      name: { type: String }, // resource URL (sanitized)
      type: { type: String }, // 'script', 'stylesheet', 'image', 'xhr', 'fetch'
      
      // Timing breakdown (all in ms)
      dns: { type: Number }, // DNS lookup time
      tcp: { type: Number }, // TCP connection time
      ssl: { type: Number }, // SSL/TLS negotiation time
      ttfb: { type: Number }, // Time to first byte
      download: { type: Number }, // Download time
      total: { type: Number }, // Total time
      
      // Size
      transferSize: { type: Number }, // bytes
      encodedBodySize: { type: Number },
      decodedBodySize: { type: Number },
      
      // Cache
      fromCache: { type: Boolean },
      cacheHit: { type: Boolean },
      
      // Protocol
      protocol: { type: String }, // 'http/1.1', 'h2', 'h3'
      
      timestamp: { type: Date },
    }],
    
    // API call performance
    apiCalls: [{
      endpoint: String, // sanitized endpoint
      method: String, // GET, POST, etc.
      
      // Timing
      startTime: Date,
      endTime: Date,
      duration: Number, // ms
      
      // Network timing
      dnsTime: Number,
      connectTime: Number,
      requestTime: Number,
      responseTime: Number,
      
      // Response
      statusCode: Number,
      responseSize: Number, // bytes
      
      // Quality
      success: Boolean,
      error: String,
      retryCount: Number,
      
      timestamp: Date,
    }],
    
    // Aggregated metrics
    metrics: {
      // Speed
      avgDownloadSpeedMbps: Number,
      minDownloadSpeedMbps: Number,
      maxDownloadSpeedMbps: Number,
      
      // Latency
      avgLatencyMs: Number,
      minLatencyMs: Number,
      maxLatencyMs: Number,
      avgJitterMs: Number,
      
      // API performance
      avgApiResponseTime: Number,
      p50ApiResponseTime: Number, // median
      p95ApiResponseTime: Number,
      p99ApiResponseTime: Number,
      
      // Resource loading
      avgResourceLoadTime: Number,
      slowResourceCount: Number, // >3s load time
      failedResourceCount: Number,
      
      // Reliability
      successRate: Number, // 0-100
      errorRate: Number,
      timeoutRate: Number,
      
      // Data usage
      totalBytesDownloaded: Number,
      totalBytesUploaded: Number,
      totalDataUsageMB: Number,
    },
    
    // Quality indicators
    quality: {
      // Overall quality score (0-100)
      score: { type: Number, min: 0, max: 100, default: 50 },
      
      // Quality rating
      rating: { 
        type: String, 
        enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
        default: 'fair'
      },
      
      // Specific quality metrics
      isHighSpeed: Boolean, // >10 Mbps
      isLowLatency: Boolean, // <100ms
      isStable: Boolean, // low jitter
      isReliable: Boolean, // >95% success rate
      
      // Issues
      hasSlowConnection: Boolean,
      hasHighLatency: Boolean,
      hasPacketLoss: Boolean,
      hasInstability: Boolean,
      hasThrottling: Boolean, // detected speed throttling
    },
    
    // Network events
    events: [{
      eventType: { 
        type: String, 
        enum: [
          'online',
          'offline',
          'connection_change',
          'speed_drop',
          'speed_increase',
          'high_latency',
          'packet_loss',
          'timeout',
          'error'
        ]
      },
      timestamp: { type: Date },
      details: { type: String },
      severity: { type: String }, // 'info', 'warning', 'error', 'critical'
      
      // Context
      previousState: { type: String },
      newState: { type: String },
      impact: { type: String }, // 'none', 'minor', 'moderate', 'severe'
    }],
    
    // Offline periods
    offlinePeriods: [{
      startTime: Date,
      endTime: Date,
      duration: Number, // ms
      reason: String, // 'user_action', 'network_failure', 'browser_action'
      dataLostDuringOffline: Boolean,
    }],
    
    // Performance degradation
    degradation: {
      hasPerformanceDrop: Boolean,
      dropPercentage: Number, // % decrease from baseline
      dropStartTime: Date,
      dropDuration: Number, // ms
      possibleCauses: [String], // 'congestion', 'throttling', 'distance', 'interference'
    },
    
    // Geographic & ISP info
    geo: {
      country: String,
      city: String,
      region: String,
      isp: String, // Internet Service Provider
      asn: String, // Autonomous System Number
      
      // Distance to server
      estimatedDistanceKm: Number,
      estimatedLatencyMs: Number, // based on distance
    },
    
    // Device context
    device: {
      platform: String,
      userAgent: String,
      isMobile: Boolean,
      
      // Battery impact
      batteryLevel: Number,
      isCharging: Boolean,
      batteryDrainRate: Number, // % per hour
      
      // Memory
      deviceMemoryGB: Number,
      
      // CPU
      hardwareConcurrency: Number,
    },
    
    // Recommendations
    recommendations: [{
      type: String, // 'reduce_quality', 'enable_compression', 'use_cdn', 'cache_more'
      reason: String,
      priority: String, // 'low', 'medium', 'high'
      estimatedImprovement: String,
    }],
    
    // Session context
    startTime: { type: Date, default: Date.now, index: true },
    endTime: Date,
    duration: Number,
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
networkPerformanceSchema.index({ sessionId: 1, page: 1 });
networkPerformanceSchema.index({ userId: 1, startTime: -1 });
networkPerformanceSchema.index({ 'connection.effectiveType': 1 });
networkPerformanceSchema.index({ 'quality.score': -1 });
networkPerformanceSchema.index({ 'metrics.avgLatencyMs': 1 });
networkPerformanceSchema.index({ 'metrics.avgDownloadSpeedMbps': -1 });

// Pre-save hook: Calculate quality score
networkPerformanceSchema.pre('save', function(next) {
  if (this.metrics.avgDownloadSpeedMbps !== undefined && this.metrics.avgLatencyMs !== undefined) {
    let score = 100;
    
    // Speed scoring (0-50 points)
    const speed = this.metrics.avgDownloadSpeedMbps;
    if (speed >= 50) score -= 0;
    else if (speed >= 25) score -= 10;
    else if (speed >= 10) score -= 20;
    else if (speed >= 5) score -= 30;
    else if (speed >= 1) score -= 40;
    else score -= 50;
    
    // Latency scoring (0-30 points)
    const latency = this.metrics.avgLatencyMs;
    if (latency <= 50) score -= 0;
    else if (latency <= 100) score -= 10;
    else if (latency <= 200) score -= 20;
    else if (latency <= 500) score -= 25;
    else score -= 30;
    
    // Reliability scoring (0-20 points)
    const successRate = this.metrics.successRate || 100;
    score -= (100 - successRate) * 0.2;
    
    this.quality.score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Determine rating
    if (this.quality.score >= 80) this.quality.rating = 'excellent';
    else if (this.quality.score >= 60) this.quality.rating = 'good';
    else if (this.quality.score >= 40) this.quality.rating = 'fair';
    else if (this.quality.score >= 20) this.quality.rating = 'poor';
    else this.quality.rating = 'critical';
    
    // Set quality flags
    this.quality.isHighSpeed = speed >= 10;
    this.quality.isLowLatency = latency <= 100;
    this.quality.isStable = (this.metrics.avgJitterMs || 0) < 50;
    this.quality.isReliable = successRate >= 95;
    
    this.quality.hasSlowConnection = speed < 1;
    this.quality.hasHighLatency = latency > 500;
    this.quality.hasInstability = (this.metrics.avgJitterMs || 0) > 100;
  }
  
  next();
});

// Method: Detect throttling
networkPerformanceSchema.methods.detectThrottling = function() {
  const tests = this.speedTests || [];
  if (tests.length < 3) return { detected: false, confidence: 0 };
  
  // Check for consistent speed cap
  const speeds = tests.map(t => t.downloadSpeedMbps).filter(Boolean);
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avg, 2), 0) / speeds.length;
  const stdDev = Math.sqrt(variance);
  
  // Low variance + suspiciously round number = throttling
  const isLowVariance = stdDev < avg * 0.1;
  const isRoundNumber = avg % 1 === 0 || avg % 0.5 === 0;
  
  const detected = isLowVariance && isRoundNumber && avg < 10;
  const confidence = detected ? Math.min(90, 50 + (1 - stdDev / avg) * 40) : 0;
  
  return { detected, confidence, suspectedCap: avg };
};

// Static method: Get network quality distribution
networkPerformanceSchema.statics.getQualityDistribution = async function(filters = {}) {
  return await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: '$quality.rating',
        count: { $sum: 1 },
        avgSpeed: { $avg: '$metrics.avgDownloadSpeedMbps' },
        avgLatency: { $avg: '$metrics.avgLatencyMs' },
        avgScore: { $avg: '$quality.score' },
      }
    },
    { $sort: { avgScore: -1 } }
  ]);
};

const NetworkPerformance = mongoose.models.NetworkPerformance || 
  mongoose.model("NetworkPerformance", networkPerformanceSchema, "networkPerformances");

export default NetworkPerformance;
