// models/KeystrokeTiming.model.js
// Behavioral biometrics - keystroke dynamics for user identification
import mongoose, { Schema } from "mongoose";

const keystrokeTimingSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true },
    
    // Keystroke events (sanitized - NO password fields)
    keystrokes: [{
      // Key info (sanitized)
      keyCategory: { 
        type: String, 
        enum: ['letter', 'number', 'special', 'modifier', 'navigation', 'function', 'backspace', 'enter']
      },
      keyCode: Number,
      
      // Timing (microsecond precision)
      timestamp: { type: Number, required: true }, // ms since page load
      dwellTime: Number, // key press duration (ms)
      flightTime: Number, // time since previous key release (ms)
      
      // Context
      elementType: String, // 'input', 'textarea', 'contenteditable'
      elementId: String, // hashed identifier
      inputType: String, // 'text', 'email', 'search', etc.
      
      // Modifiers
      shiftKey: Boolean,
      ctrlKey: Boolean,
      altKey: Boolean,
      metaKey: Boolean,
      
      // Position in sequence
      sequenceIndex: Number,
      isFirstKey: Boolean,
      isLastKey: Boolean,
    }],
    
    // Digraph timing (two-key combinations)
    digraphs: [{
      key1: String,
      key2: String,
      interval: Number, // ms between key1 press and key2 press
      frequency: Number, // how often this pair appears
    }],
    
    // Trigraph timing (three-key combinations)
    trigraphs: [{
      keys: [String],
      intervals: [Number],
      frequency: Number,
    }],
    
    // Typing metrics
    metrics: {
      totalKeystrokes: { type: Number, default: 0 },
      netKeystrokes: Number, // excluding backspaces
      
      // Speed
      wpm: Number, // words per minute
      cpm: Number, // characters per minute
      burstSpeed: Number, // max WPM in any 10-second window
      
      // Timing statistics
      avgDwellTime: Number,
      stdDevDwellTime: Number,
      avgFlightTime: Number,
      stdDevFlightTime: Number,
      
      // Rhythm
      rhythmConsistency: Number, // 0-1, higher = more consistent
      typingCadence: String, // 'fast', 'medium', 'slow', 'irregular'
      
      // Errors
      backspaceCount: Number,
      backspaceRatio: Number, // backspaces / total keys
      errorCorrectionSpeed: Number, // avg time to fix errors
      
      // Pauses
      shortPauseCount: Number, // 0.5-2s
      mediumPauseCount: Number, // 2-5s
      longPauseCount: Number, // >5s
      avgPauseLength: Number,
      
      // Copy-paste
      pasteCount: Number,
      pasteRatio: Number,
    },
    
    // Behavioral signature (for user identification)
    biometricSignature: {
      dwellTimeVector: [Number], // distribution of dwell times
      flightTimeVector: [Number], // distribution of flight times
      commonDigraphs: [{ keys: String, avgTime: Number }],
      uniquenessScore: Number, // 0-100, how unique this pattern is
      confidenceLevel: Number, // 0-100, reliability of signature
    },
    
    // Pattern analysis
    patterns: {
      hasTypoPattern: Boolean, // frequent backspace after specific keys
      hasHuntAndPeck: Boolean, // slow, irregular typing
      hasTouchTyping: Boolean, // fast, consistent typing
      hasAutoComplete: Boolean, // sudden speed bursts
      hasCopyPaste: Boolean,
      hasKeyboardShortcuts: Boolean, // Ctrl+C, Ctrl+V, etc.
    },
    
    // Anomaly detection
    anomalies: [{
      type: String, // 'impossible_speed', 'bot_pattern', 'macro_detected'
      confidence: Number,
      timestamp: Number,
      details: String,
    }],
    
    // Bot detection
    botScore: { type: Number, min: 0, max: 100, default: 0 },
    botIndicators: {
      perfectTiming: Boolean, // too consistent
      impossibleSpeed: Boolean, // >200 WPM sustained
      noVariation: Boolean, // stdDev too low
      macroPattern: Boolean, // repeated exact sequences
      noErrors: Boolean, // no backspaces in long text
    },
    
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
keystrokeTimingSchema.index({ sessionId: 1, page: 1 });
keystrokeTimingSchema.index({ userId: 1, startTime: -1 });
keystrokeTimingSchema.index({ 'metrics.wpm': -1 });
keystrokeTimingSchema.index({ 'biometricSignature.uniquenessScore': -1 });
keystrokeTimingSchema.index({ botScore: -1 });

// Method: Calculate biometric distance between two signatures
keystrokeTimingSchema.statics.calculateBiometricDistance = function(sig1, sig2) {
  if (!sig1 || !sig2) return 1; // max distance
  
  // Euclidean distance between dwell time vectors
  const dwellDist = Math.sqrt(
    sig1.dwellTimeVector.reduce((sum, val, i) => 
      sum + Math.pow(val - (sig2.dwellTimeVector[i] || 0), 2), 0
    )
  );
  
  // Normalize to 0-1
  return Math.min(dwellDist / 100, 1);
};

// Method: Detect if this matches a known user's typing pattern
keystrokeTimingSchema.methods.matchesUser = async function(userId) {
  const historicalSamples = await this.constructor.find({ 
    userId, 
    'biometricSignature.confidenceLevel': { $gte: 70 }
  }).limit(10).lean();
  
  if (historicalSamples.length < 3) return { match: false, confidence: 0 };
  
  const distances = historicalSamples.map(sample => 
    this.constructor.calculateBiometricDistance(
      this.biometricSignature, 
      sample.biometricSignature
    )
  );
  
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const match = avgDistance < 0.3; // threshold
  const confidence = Math.round((1 - avgDistance) * 100);
  
  return { match, confidence, avgDistance };
};

const KeystrokeTiming = mongoose.models.KeystrokeTiming || 
  mongoose.model("KeystrokeTiming", keystrokeTimingSchema, "keystrokeTimings");

export default KeystrokeTiming;
