// models/MouseMovement.model.js
// Enterprise-grade mouse tracking with path compression & ML features
import mongoose, { Schema } from "mongoose";

const mouseMovementSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true, index: true },
    
    // Compressed movement path (RDP algorithm applied patron-side)
    // Format: [[x1,y1,t1,e1], [x2,y2,t2,e2], ...] where e = event type code
    compressedPath: { type: [[Number]], required: true },
    
    // Raw path metadata
    totalPoints: { type: Number, required: true },
    compressionRatio: { type: Number }, // original/compressed
    
    // Viewport & device context
    viewportWidth: { type: Number, required: true },
    viewportHeight: { type: Number, required: true },
    devicePixelRatio: { type: Number, default: 1 },
    scrollHeight: { type: Number },
    scrollWidth: { type: Number },
    
    // Movement analytics
    totalDistance: { type: Number }, // pixels traveled
    avgSpeed: { type: Number }, // px/s
    maxSpeed: { type: Number },
    minSpeed: { type: Number },
    avgAcceleration: { type: Number }, // px/s²
    
    // Behavioral patterns
    straightLineRatio: { type: Number }, // 0-1, higher = more direct movement
    curvatureIndex: { type: Number }, // path complexity
    idleTimeMs: { type: Number, default: 0 },
    hoverTimeMs: { type: Number, default: 0 },
    
    // Click analytics
    clicks: [{
      x: Number,
      y: Number,
      timestamp: Number,
      button: Number, // 0=left, 1=middle, 2=right
      target: String, // CSS selector
      isRageClick: Boolean,
      dwellTimeBefore: Number, // ms hovering before click
    }],
    
    // Scroll correlation
    scrollEvents: [{
      timestamp: Number,
      scrollY: Number,
      scrollX: Number,
      deltaY: Number,
      deltaX: Number,
    }],
    
    // Dead zones (areas never visited)
    deadZones: [{
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    }],
    
    // Hot zones (high activity areas)
    hotZones: [{
      x: Number,
      y: Number,
      radius: Number,
      density: Number, // points per pixel
    }],
    
    // ML features
    features: {
      entropy: Number, // movement randomness
      fractalDimension: Number, // path complexity measure
      angularVelocity: Number, // direction change rate
      pauseCount: Number,
      backtrackCount: Number, // mouse moved backward
      zigzagCount: Number,
    },
    
    // Bot detection signals
    botScore: { type: Number, min: 0, max: 100, default: 0 },
    botIndicators: {
      perfectLines: Boolean, // too straight movements
      constantSpeed: Boolean, // no natural variation
      impossibleSpeed: Boolean, // > 5000 px/s
      noAcceleration: Boolean,
      instantJumps: Boolean, // teleportation
    },
    
    // Timestamps
    startTime: { type: Date, default: Date.now, index: true },
    endTime: { type: Date },
    duration: { type: Number }, // milliseconds
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Compound indexes for complex queries
mouseMovementSchema.index({ page: 1, startTime: -1 });
mouseMovementSchema.index({ sessionId: 1, page: 1 });
mouseMovementSchema.index({ userId: 1, startTime: -1 });
mouseMovementSchema.index({ botScore: -1, startTime: -1 });
mouseMovementSchema.index({ 'features.entropy': -1 });

// Virtual for heatmap generation
mouseMovementSchema.virtual('heatmapData').get(function() {
  return this.compressedPath.map(([x, y, t]) => ({ x, y, weight: 1 }));
});

// Method to detect anomalies
mouseMovementSchema.methods.detectAnomalies = function() {
  const anomalies = [];
  
  if (this.avgSpeed > 5000) anomalies.push('impossible_speed');
  if (this.straightLineRatio > 0.95) anomalies.push('bot_like_movement');
  if (this.features.entropy < 0.1) anomalies.push('low_entropy');
  if (this.clicks.filter(c => c.isRageClick).length > 5) anomalies.push('user_frustration');
  
  return anomalies;
};

const MouseMovement = mongoose.models.MouseMovement || 
  mongoose.model("MouseMovement", mouseMovementSchema, "mouseMovements");

export default MouseMovement;
