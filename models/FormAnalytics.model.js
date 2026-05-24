// models/FormAnalytics.model.js
// Field-level form tracking - understand form behavior and abandonment
import mongoose, { Schema } from "mongoose";

const formAnalyticsSchema = new Schema(
  {
    visitorId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, index: true },
    page: { type: String, required: true, index: true },
    
    // Form identification
    form: {
      id: String, // form ID or name
      name: String,
      action: String, // form action URL
      method: String, // GET/POST
      type: String, // 'signup', 'login', 'checkout', 'contact', 'survey'
      selector: String, // CSS selector
    },
    
    // Form session
    session: {
      startTime: { type: Date, required: true, index: true },
      endTime: Date,
      duration: Number, // milliseconds
      
      // Status
      status: { 
        type: String, 
        enum: ['started', 'in_progress', 'completed', 'abandoned', 'error'],
        default: 'started',
        index: true
      },
      
      // Completion
      submitted: Boolean,
      submittedAt: Date,
      successful: Boolean, // submission succeeded
      
      // Attempts
      submitAttempts: Number,
      validationAttempts: Number,
    },
    
    // Field-level tracking
    fields: [{
      // Field identification
      name: String,
      id: String,
      type: String, // 'text', 'email', 'password', 'select', 'checkbox', 'radio', 'textarea'
      label: String,
      placeholder: String,
      required: Boolean,
      
      // Interaction timeline
      interactions: [{
        type: String, // 'focus', 'blur', 'input', 'change', 'paste', 'clear'
        timestamp: Date,
        value: String, // sanitized/hashed for sensitive fields
        cursorPosition: Number,
      }],
      
      // Timing
      firstFocusAt: Date,
      lastBlurAt: Date,
      totalFocusTime: Number, // milliseconds
      avgFocusTime: Number,
      
      // Engagement
      focusCount: Number,
      blurCount: Number,
      inputCount: Number, // keystrokes
      changeCount: Number,
      pasteCount: Number,
      
      // Hesitation
      hesitationTime: Number, // time between focus and first input
      pauseCount: Number, // pauses during input
      avgPauseDuration: Number,
      
      // Corrections
      backspaceCount: Number,
      deleteCount: Number,
      correctionRate: Number, // corrections / total inputs
      
      // Value analysis (privacy-safe)
      valueLength: Number,
      valueType: String, // 'empty', 'partial', 'complete', 'invalid'
      valueChanged: Boolean, // value changed after initial input
      changeCount: Number,
      
      // Validation
      validationErrors: [{
        message: String,
        timestamp: Date,
        resolved: Boolean,
      }],
      validationErrorCount: Number,
      
      // Completion
      completed: Boolean,
      completedAt: Date,
      timeToComplete: Number, // ms from first focus to completion
      
      // Abandonment
      abandoned: Boolean,
      abandonedAt: Date,
      abandonmentReason: String, // 'switched_field', 'left_form', 'closed_page'
      
      // Difficulty score
      difficultyScore: Number, // 0-100, higher = more difficult
    }],
    
    // Field sequence (order of interaction)
    fieldSequence: [{
      fieldName: String,
      timestamp: Date,
      action: String, // 'focus', 'complete', 'skip'
    }],
    
    // Form-level metrics
    metrics: {
      // Completion
      completionRate: Number, // 0-100
      completionTime: Number, // milliseconds
      
      // Fields
      totalFields: Number,
      requiredFields: Number,
      completedFields: Number,
      abandonedFields: Number,
      fieldsWithErrors: Number,
      
      // Engagement
      totalFocusTime: Number,
      avgFieldFocusTime: Number,
      totalInputs: Number,
      totalCorrections: Number,
      
      // Difficulty
      overallDifficulty: Number, // 0-100
      mostDifficultField: String,
      
      // Errors
      totalErrors: Number,
      errorRate: Number,
      
      // Efficiency
      straightThroughRate: Number, // % completed without errors/corrections
    },
    
    // Abandonment analysis
    abandonment: {
      abandoned: Boolean,
      abandonedAt: Date,
      abandonmentPoint: String, // field name where user left
      abandonmentStep: Number, // which field number
      completionPercentage: Number, // how far they got
      
      // Reasons (inferred)
      likelyReasons: [{
        reason: String, // 'too_long', 'too_difficult', 'privacy_concern', 'technical_issue'
        confidence: Number, // 0-100
        evidence: [String],
      }],
      
      // Context
      timeBeforeAbandonment: Number, // ms spent before abandoning
      fieldsCompletedBeforeAbandonment: Number,
      errorsBeforeAbandonment: Number,
      
      // Recovery
      returned: Boolean,
      returnedAt: Date,
      timeBetweenAbandonmentAndReturn: Number,
    },
    
    // Validation errors
    validationErrors: [{
      fieldName: String,
      errorType: String, // 'required', 'format', 'length', 'custom'
      errorMessage: String,
      timestamp: Date,
      resolved: Boolean,
      timeToResolve: Number,
    }],
    
    // Submission
    submission: {
      attempted: Boolean,
      attemptedAt: Date,
      successful: Boolean,
      
      // Response
      responseTime: Number, // server response time
      statusCode: Number,
      errorMessage: String,
      
      // Retry
      retryCount: Number,
      retryReasons: [String],
    },
    
    // User behavior
    behavior: {
      // Navigation
      usedTabKey: Boolean,
      usedMouseToNavigate: Boolean,
      usedKeyboardShortcuts: Boolean,
      
      // Input method
      usedAutofill: Boolean,
      usedPaste: Boolean,
      usedCopyPaste: Boolean,
      
      // Patterns
      hasLinearProgression: Boolean, // filled fields in order
      hasBacktracking: Boolean, // went back to previous fields
      hasSkipping: Boolean, // skipped optional fields
      
      // Speed
      typingSpeed: Number, // WPM
      formFillingSpeed: String, // 'fast', 'medium', 'slow'
      
      // Confidence
      confidenceLevel: String, // 'high', 'medium', 'low' (based on hesitation, corrections)
    },
    
    // Context
    context: {
      // Device
      device: String,
      browser: String,
      screenSize: String,
      
      // Form visibility
      wasVisible: Boolean,
      visibilityPercentage: Number, // % of time form was visible
      
      // Distractions
      tabSwitches: Number,
      focusLosses: Number,
      
      // Network
      networkSpeed: String,
      hadNetworkIssues: Boolean,
    },
    
    // A/B test variant (if applicable)
    experiment: {
      testId: { type: Schema.Types.ObjectId, ref: 'ABTest' },
      variantId: String,
      variantName: String,
    },
    
    // Recommendations
    recommendations: [{
      type: String, // 'simplify_field', 'add_help_text', 'improve_validation', 'reduce_fields'
      fieldName: String,
      priority: String,
      description: String,
      expectedImprovement: Number, // % improvement in completion rate
    }],
  },
  { 
    timestamps: true,
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Indexes
formAnalyticsSchema.index({ sessionId: 1, 'form.id': 1 });
formAnalyticsSchema.index({ userId: 1, 'session.startTime': -1 });
formAnalyticsSchema.index({ page: 1, 'form.type': 1 });
formAnalyticsSchema.index({ 'session.status': 1 });
formAnalyticsSchema.index({ 'abandonment.abandoned': 1 });
formAnalyticsSchema.index({ 'metrics.completionRate': -1 });

// Method: Calculate field difficulty
formAnalyticsSchema.methods.calculateFieldDifficulty = function(field) {
  let difficulty = 0;
  
  // Time-based difficulty
  if (field.totalFocusTime > 30000) difficulty += 20; // >30s
  if (field.hesitationTime > 5000) difficulty += 15; // >5s hesitation
  
  // Error-based difficulty
  difficulty += Math.min(field.validationErrorCount * 10, 30);
  
  // Correction-based difficulty
  difficulty += Math.min(field.correctionRate * 20, 20);
  
  // Interaction-based difficulty
  if (field.focusCount > 3) difficulty += 10; // multiple focuses
  if (field.pauseCount > 5) difficulty += 10; // many pauses
  
  return Math.min(difficulty, 100);
};

// Method: Infer abandonment reasons
formAnalyticsSchema.methods.inferAbandonmentReasons = function() {
  const reasons = [];
  
  if (this.metrics.totalFields > 10) {
    reasons.push({
      reason: 'too_long',
      confidence: 70,
      evidence: [`Form has ${this.metrics.totalFields} fields`]
    });
  }
  
  if (this.metrics.errorRate > 0.3) {
    reasons.push({
      reason: 'too_difficult',
      confidence: 80,
      evidence: [`High error rate: ${(this.metrics.errorRate * 100).toFixed(1)}%`]
    });
  }
  
  if (this.metrics.overallDifficulty > 70) {
    reasons.push({
      reason: 'too_difficult',
      confidence: 75,
      evidence: [`High difficulty score: ${this.metrics.overallDifficulty}`]
    });
  }
  
  const sensitiveFields = this.fields.filter(f => 
    f.type === 'password' || f.type === 'ssn' || f.name.includes('credit')
  );
  if (sensitiveFields.length > 0 && this.abandonment.abandonmentPoint === sensitiveFields[0].name) {
    reasons.push({
      reason: 'privacy_concern',
      confidence: 60,
      evidence: ['Abandoned at sensitive field']
    });
  }
  
  return reasons;
};

// Static method: Get form performance
formAnalyticsSchema.statics.getFormPerformance = async function(formId) {
  return await this.aggregate([
    { $match: { 'form.id': formId } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: { 
          $sum: { $cond: ['$session.submitted', 1, 0] }
        },
        abandonedSessions: {
          $sum: { $cond: ['$abandonment.abandoned', 1, 0] }
        },
        avgCompletionTime: { $avg: '$metrics.completionTime' },
        avgDifficulty: { $avg: '$metrics.overallDifficulty' },
        totalErrors: { $sum: '$metrics.totalErrors' },
      }
    },
    {
      $project: {
        totalSessions: 1,
        completedSessions: 1,
        abandonedSessions: 1,
        completionRate: {
          $multiply: [{ $divide: ['$completedSessions', '$totalSessions'] }, 100]
        },
        abandonmentRate: {
          $multiply: [{ $divide: ['$abandonedSessions', '$totalSessions'] }, 100]
        },
        avgCompletionTime: 1,
        avgDifficulty: 1,
        totalErrors: 1,
      }
    }
  ]);
};

// Static method: Get field-level insights
formAnalyticsSchema.statics.getFieldInsights = async function(formId, fieldName) {
  return await this.aggregate([
    { $match: { 'form.id': formId } },
    { $unwind: '$fields' },
    { $match: { 'fields.name': fieldName } },
    {
      $group: {
        _id: null,
        totalInteractions: { $sum: 1 },
        avgFocusTime: { $avg: '$fields.totalFocusTime' },
        avgHesitation: { $avg: '$fields.hesitationTime' },
        avgCorrections: { $avg: '$fields.backspaceCount' },
        avgDifficulty: { $avg: '$fields.difficultyScore' },
        completionRate: {
          $avg: { $cond: ['$fields.completed', 1, 0] }
        },
        errorRate: {
          $avg: { $cond: [{ $gt: ['$fields.validationErrorCount', 0] }, 1, 0] }
        },
      }
    }
  ]);
};

const FormAnalytics = mongoose.models.FormAnalytics || 
  mongoose.model("FormAnalytics", formAnalyticsSchema, "formAnalytics");

export default FormAnalytics;

