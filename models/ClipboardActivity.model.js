// models/ClipboardActivity.model.js
// Forensic clipboard tracking with security threat detection
import mongoose, { Schema } from "mongoose";
import crypto from "crypto";

const clipboardActivitySchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true, index: true },
    
    eventType: { 
      type: String, 
      enum: ['copy', 'cut', 'paste', 'clipboard_read', 'clipboard_write'], 
      required: true,
      index: true
    },
    
    // Content metadata (NEVER store actual sensitive content)
    content: {
      length: { type: Number, required: true },
      type: { 
        type: String, 
        enum: ['text/plain', 'text/html', 'text/rtf', 'image/png', 'image/jpeg', 'application/json', 'unknown']
      },
      
      // Privacy-preserving hash (SHA-256)
      hash: { type: String, index: true }, // for duplicate detection
      
      // Content analysis (without storing content)
      hasUrls: Boolean,
      hasEmails: Boolean,
      hasPhoneNumbers: Boolean,
      hasCreditCards: Boolean, // pattern detection only
      hasPasswords: Boolean, // heuristic detection
      hasCode: Boolean, // programming language detected
      language: String, // detected language
      
      // Structure
      lineCount: Number,
      wordCount: Number,
      charCount: Number,
      
      // Entropy (randomness measure)
      entropy: Number, // 0-8, higher = more random
    },
    
    // Source context
    source: {
      element: String, // CSS selector
      elementType: String, // 'input', 'textarea', 'div', 'pre', 'code'
      elementId: String,
      elementClass: String,
      isEditable: Boolean,
      isPasswordField: Boolean,
      isFormField: Boolean,
      fieldName: String, // sanitized
      
      // Selection info
      selectionStart: Number,
      selectionEnd: Number,
      selectedText: String, // first/last 10 chars only for context
      
      // Page context
      pageTitle: String,
      pageUrl: String, // sanitized
    },
    
    // Target context (for paste events)
    target: {
      element: String,
      elementType: String,
      elementId: String,
      isEditable: Boolean,
      isFormField: Boolean,
      fieldName: String,
      
      // Pre-paste state
      existingContentLength: Number,
      cursorPosition: Number,
    },
    
    // Timing
    timestamp: { type: Date, default: Date.now, index: true },
    timeSincePageLoad: Number, // milliseconds
    timeSinceLastClipboard: Number, // ms since last clipboard event
    
    // User behavior
    behavior: {
      isRapidFire: Boolean, // multiple clipboard ops in <1s
      isSequential: Boolean, // copy then paste immediately
      isCrossDomain: Boolean, // paste from external source
      isAutomated: Boolean, // bot-like pattern
      
      // Keyboard shortcuts used
      usedCtrlC: Boolean,
      usedCtrlV: Boolean,
      usedCtrlX: Boolean,
      usedRightClick: Boolean,
      usedMenuBar: Boolean,
    },
    
    // Security flags
    security: {
      threatLevel: { 
        type: String, 
        enum: ['none', 'low', 'medium', 'high', 'critical'],
        default: 'none',
        index: true
      },
      
      threats: [{
        type: String, // 'data_exfiltration', 'credential_theft', 'code_injection', 'xss_attempt'
        confidence: Number, // 0-100
        reason: String,
      }],
      
      // Specific threat indicators
      isPotentialDataTheft: Boolean, // large copy from sensitive area
      isPotentialCredentialTheft: Boolean, // password field copy
      isPotentialXSS: Boolean, // script tags in paste
      isPotentialSQLInjection: Boolean, // SQL patterns in paste
      isPotentialCodeInjection: Boolean,
      
      // Anomaly scores
      anomalyScore: { type: Number, min: 0, max: 100, default: 0 },
    },
    
    // Context correlation
    correlation: {
      mouseMovementId: { type: Schema.Types.ObjectId, ref: 'MouseMovement' },
      keystrokeTimingId: { type: Schema.Types.ObjectId, ref: 'KeystrokeTiming' },
      
      // Before/after behavior
      mouseActivityBefore: Number, // movements in 5s before
      mouseActivityAfter: Number,
      keystrokesAfter: Number, // keys typed after paste
      
      // Form submission correlation
      submittedWithinSeconds: Number, // if form submitted after paste
      formSubmissionId: Schema.Types.ObjectId,
    },
    
    // Frequency tracking
    frequency: {
      userTotalCopies: Number, // lifetime copies by this user
      userTotalPastes: Number,
      sessionCopies: Number, // in this session
      sessionPastes: Number,
      pageCopies: Number, // on this page
      pagePastes: Number,
    },
    
    // Device & browser
    device: {
      platform: String,
      userAgent: String,
      clipboardAPISupported: Boolean,
      permissionStatus: String, // 'granted', 'denied', 'prompt'
    },
  },
  { 
    timestamps: true,
    expireAfterSeconds: 15552000, // 180 days (longer retention for security)
  }
);

// Compound indexes
clipboardActivitySchema.index({ sessionId: 1, timestamp: -1 });
clipboardActivitySchema.index({ userId: 1, eventType: 1, timestamp: -1 });
clipboardActivitySchema.index({ page: 1, eventType: 1 });
clipboardActivitySchema.index({ 'security.threatLevel': 1, timestamp: -1 });
clipboardActivitySchema.index({ 'content.hash': 1 });
clipboardActivitySchema.index({ 'security.anomalyScore': -1 });

// Pre-save hook: Calculate threat level
clipboardActivitySchema.pre('save', function(next) {
  const threats = this.security.threats || [];
  
  if (threats.length === 0) {
    this.security.threatLevel = 'none';
  } else {
    const maxConfidence = Math.max(...threats.map(t => t.confidence));
    if (maxConfidence >= 90) this.security.threatLevel = 'critical';
    else if (maxConfidence >= 70) this.security.threatLevel = 'high';
    else if (maxConfidence >= 50) this.security.threatLevel = 'medium';
    else this.security.threatLevel = 'low';
  }
  
  next();
});

// Static method: Detect content patterns
clipboardActivitySchema.statics.analyzeContent = function(text) {
  if (!text || typeof text !== 'string') return {};
  
  const analysis = {
    hasUrls: /https?:\/\/[^\s]+/.test(text),
    hasEmails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text),
    hasPhoneNumbers: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text),
    hasCreditCards: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text),
    hasPasswords: text.length > 8 && /[A-Z]/.test(text) && /[a-z]/.test(text) && /\d/.test(text),
    hasCode: /<[^>]+>|function\s*\(|const\s+\w+\s*=|import\s+/.test(text),
    
    // Calculate entropy
    entropy: calculateEntropy(text),
    
    // Structure
    lineCount: (text.match(/\n/g) || []).length + 1,
    wordCount: text.split(/\s+/).length,
    charCount: text.length,
  };
  
  return analysis;
};

// Helper: Calculate Shannon entropy
function calculateEntropy(str) {
  const freq = {};
  for (let char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (let char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

// Method: Generate privacy-safe hash
clipboardActivitySchema.methods.generateHash = function(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
};

const ClipboardActivity = mongoose.models.ClipboardActivity || 
  mongoose.model("ClipboardActivity", clipboardActivitySchema, "clipboardActivities");

export default ClipboardActivity;
