// models/GDPRCompliance.model.js
// GDPR & Privacy Compliance - consent, data export, deletion, audit trails
import mongoose, { Schema } from "mongoose";

const gdprComplianceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    
    // Consent Management
    consent: {
      // Overall consent status
      status: { 
        type: String, 
        enum: ['pending', 'given', 'withdrawn', 'expired'],
        default: 'pending',
        index: true
      },
      
      // Granular consents
      purposes: [{
        purpose: { 
          type: String, 
          required: true,
          enum: [
            'necessary', // Essential for service
            'analytics', // Usage analytics
            'marketing', // Marketing communications
            'personalization', // Personalized content
            'advertising', // Targeted ads
            'third_party_sharing', // Share with partners
            'profiling', // Automated decision making
          ]
        },
        
        // Consent details
        consented: Boolean,
        consentedAt: Date,
        withdrawnAt: Date,
        
        // Legal basis
        legalBasis: { 
          type: String, 
          enum: ['consent', 'contract', 'legal_obligation', 'vital_interest', 'public_task', 'legitimate_interest']
        },
        
        // Expiry
        expiresAt: Date,
        autoRenew: Boolean,
        
        // Version
        consentVersion: String,
        policyVersion: String,
        
        // Method
        consentMethod: String, // 'explicit', 'implicit', 'opt_in', 'opt_out'
        consentSource: String, // 'web', 'mobile', 'email', 'api'
        
        // IP & Device
        ipAddress: String,
        userAgent: String,
        
        // History
        history: [{
          action: String, // 'given', 'withdrawn', 'renewed', 'expired'
          timestamp: Date,
          reason: String,
          ipAddress: String,
        }],
      }],
      
      // Cookie consent
      cookies: {
        necessary: { type: Boolean, default: true }, // Always true
        functional: Boolean,
        analytics: Boolean,
        advertising: Boolean,
        
        consentedAt: Date,
        expiresAt: Date,
        
        // Cookie banner
        bannerShown: Boolean,
        bannerShownAt: Date,
        bannerVersion: String,
      },
      
      // Communication preferences
      communications: {
        email: Boolean,
        sms: Boolean,
        push: Boolean,
        phone: Boolean,
        
        // Frequency
        frequency: String, // 'daily', 'weekly', 'monthly', 'never'
        
        // Types
        transactional: { type: Boolean, default: true },
        promotional: Boolean,
        newsletter: Boolean,
        productUpdates: Boolean,
        
        updatedAt: Date,
      },
    },
    
    // Data Subject Rights
    rights: {
      // Right to Access (Codex 15)
      access: [{
        requestedAt: Date,
        requestId: String,
        status: String, // 'pending', 'processing', 'completed', 'rejected'
        completedAt: Date,
        
        // Data provided
        dataExportUrl: String,
        dataExportFormat: String, // 'json', 'csv', 'pdf'
        dataExportSize: Number, // bytes
        expiresAt: Date,
        
        // Processing
        processingTime: Number, // milliseconds
        rejectionReason: String,
      }],
      
      // Right to Rectification (Codex 16)
      rectification: [{
        requestedAt: Date,
        requestId: String,
        status: String,
        completedAt: Date,
        
        // Changes
        fieldsUpdated: [String],
        oldValues: Schema.Types.Mixed,
        newValues: Schema.Types.Mixed,
        
        verificationRequired: Boolean,
        verified: Boolean,
      }],
      
      // Right to Erasure / Right to be Forgotten (Codex 17)
      erasure: [{
        requestedAt: Date,
        requestId: String,
        status: String,
        completedAt: Date,
        
        // Scope
        scope: String, // 'full', 'partial'
        dataCategories: [String], // what data to delete
        
        // Retention
        retentionReason: String, // why some data is kept
        retainedData: [String],
        
        // Verification
        verificationMethod: String,
        verified: Boolean,
        
        // Execution
        deletionMethod: String, // 'soft_delete', 'hard_delete', 'anonymize'
        deletedAt: Date,
        
        // Confirmation
        confirmationSent: Boolean,
        confirmationSentAt: Date,
      }],
      
      // Right to Restriction (Codex 18)
      restriction: [{
        requestedAt: Date,
        requestId: String,
        status: String,
        
        // Restriction details
        restrictionType: String, // 'processing', 'storage', 'transfer'
        reason: String,
        
        startDate: Date,
        endDate: Date,
        
        // Impact
        affectedSystems: [String],
        affectedData: [String],
      }],
      
      // Right to Data Portability (Codex 20)
      portability: [{
        requestedAt: Date,
        requestId: String,
        status: String,
        completedAt: Date,
        
        // Export
        format: String, // 'json', 'xml', 'csv'
        dataExportUrl: String,
        dataSize: Number,
        expiresAt: Date,
        
        // Transfer to another controller
        transferTo: String,
        transferMethod: String,
        transferred: Boolean,
        transferredAt: Date,
      }],
      
      // Right to Object (Codex 21)
      objection: [{
        requestedAt: Date,
        requestId: String,
        status: String,
        
        // Objection details
        processingType: String, // 'profiling', 'marketing', 'research'
        reason: String,
        
        // Response
        accepted: Boolean,
        responseReason: String,
        respondedAt: Date,
        
        // Action taken
        actionTaken: String,
      }],
      
      // Automated Decision Making (Codex 22)
      automatedDecisions: [{
        requestedAt: Date,
        requestId: String,
        
        // Request type
        type: String, // 'explanation', 'human_review', 'opt_out'
        
        // Decision details
        decisionId: String,
        decisionType: String,
        decisionDate: Date,
        
        // Response
        explanationProvided: Boolean,
        humanReviewConducted: Boolean,
        decisionReversed: Boolean,
        
        respondedAt: Date,
      }],
    },
    
    // Data Inventory (what data we have)
    dataInventory: {
      // Personal data categories
      categories: [{
        category: String, // 'identity', 'contact', 'financial', 'behavioral', 'technical'
        dataPoints: [String],
        source: String,
        collectedAt: Date,
        purpose: String,
        legalBasis: String,
        retentionPeriod: Number, // days
        expiresAt: Date,
      }],
      
      // Data locations
      locations: [{
        system: String, // 'database', 's3', 'redis', 'elasticsearch'
        location: String,
        dataTypes: [String],
        encrypted: Boolean,
        backupExists: Boolean,
      }],
      
      // Third-party processors
      processors: [{
        name: String,
        purpose: String,
        dataShared: [String],
        dpaInPlace: Boolean, // Data Processing Agreement
        adequacyDecision: Boolean, // EU adequacy decision
        safeguards: [String],
      }],
      
      // Last updated
      lastAuditedAt: Date,
      nextAuditDue: Date,
    },
    
    // Audit Trail (Codex 30 - Records of Processing)
    auditTrail: [{
      timestamp: { type: Date, default: Date.now, index: true },
      
      // Event details
      eventType: { 
        type: String, 
        required: true,
        enum: [
          'data_collected',
          'data_accessed',
          'data_modified',
          'data_deleted',
          'data_exported',
          'data_shared',
          'consent_given',
          'consent_withdrawn',
          'right_exercised',
          'breach_detected',
          'breach_notified',
        ]
      },
      
      // Actor
      actor: {
        type: String, // 'user', 'admin', 'system', 'third_party'
        id: String,
        name: String,
        role: String,
      },
      
      // Data affected
      dataCategory: String,
      dataFields: [String],
      recordCount: Number,
      
      // Context
      purpose: String,
      legalBasis: String,
      
      // Technical details
      ipAddress: String,
      userAgent: String,
      location: String,
      
      // Changes (for modifications)
      changes: {
        before: Schema.Types.Mixed,
        after: Schema.Types.Mixed,
      },
      
      // Metadata
      metadata: Schema.Types.Mixed,
    }],
    
    // Data Breaches
    breaches: [{
      // Breach details
      breachId: { type: String, unique: true },
      detectedAt: Date,
      reportedAt: Date,
      
      // Severity
      severity: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'critical']
      },
      
      // Affected data
      affectedDataCategories: [String],
      affectedRecordCount: Number,
      
      // Impact
      riskLevel: String, // 'low', 'high'
      potentialConsequences: [String],
      
      // Notification
      supervisoryAuthorityNotified: Boolean,
      supervisoryAuthorityNotifiedAt: Date,
      
      dataSubjectNotified: Boolean,
      dataSubjectNotifiedAt: Date,
      notificationMethod: String,
      
      // Response
      mitigationActions: [String],
      resolved: Boolean,
      resolvedAt: Date,
      
      // Documentation
      incidentReport: String,
      rootCause: String,
      preventiveMeasures: [String],
    }],
    
    // Retention & Deletion
    retention: {
      // Retention policy
      policy: String,
      retentionPeriod: Number, // days
      
      // Scheduled deletion
      scheduledDeletionDate: Date,
      deletionReason: String,
      
      // Legal holds
      legalHolds: [{
        reason: String,
        startDate: Date,
        endDate: Date,
        authority: String,
      }],
      
      // Anonymization
      anonymized: Boolean,
      anonymizedAt: Date,
      anonymizationMethod: String,
    },
    
    // Privacy Settings
    privacy: {
      // Profile visibility
      profileVisibility: String, // 'public', 'private', 'friends'
      
      // Data sharing
      allowDataSharing: Boolean,
      allowThirdPartySharing: Boolean,
      allowProfiling: Boolean,
      allowAutomatedDecisions: Boolean,
      
      // Tracking
      allowTracking: Boolean,
      allowCrossSiteTracking: Boolean,
      
      // Do Not Track
      doNotTrack: Boolean,
      
      // Data minimization
      dataMinimization: Boolean, // collect only necessary data
      
      updatedAt: Date,
    },
    
    // Compliance Status
    compliance: {
      // Overall status
      status: { 
        type: String, 
        enum: ['compliant', 'non_compliant', 'under_review'],
        default: 'compliant'
      },
      
      // Issues
      issues: [{
        type: String,
        severity: String,
        description: String,
        detectedAt: Date,
        resolvedAt: Date,
        resolved: Boolean,
      }],
      
      // Last review
      lastReviewedAt: Date,
      reviewedBy: String,
      nextReviewDue: Date,
      
      // Certifications
      certifications: [{
        name: String, // 'ISO 27001', 'SOC 2', 'Privacy Shield'
        issuedAt: Date,
        expiresAt: Date,
        certificateUrl: String,
      }],
    },
    
    // Metadata
    metadata: {
      // User location
      country: String,
      region: String,
      
      // Jurisdiction
      jurisdiction: String, // 'EU', 'US', 'UK', 'CCPA'
      applicableLaws: [String], // 'GDPR', 'CCPA', 'LGPD'
      
      // Language
      preferredLanguage: String,
      
      // Age verification
      ageVerified: Boolean,
      isMinor: Boolean,
      parentalConsentRequired: Boolean,
      parentalConsentGiven: Boolean,
    },
  },
  { 
    timestamps: true,
  }
);

// Indexes
gdprComplianceSchema.index({ userId: 1 }, { unique: true });
gdprComplianceSchema.index({ email: 1 });
gdprComplianceSchema.index({ 'consent.status': 1 });
gdprComplianceSchema.index({ 'auditTrail.timestamp': -1 });
gdprComplianceSchema.index({ 'retention.scheduledDeletionDate': 1 });
gdprComplianceSchema.index({ 'compliance.status': 1 });

// Method: Check if consent is valid
gdprComplianceSchema.methods.hasValidConsent = function(purpose) {
  const purposeConsent = this.consent.purposes.find(p => p.purpose === purpose);
  if (!purposeConsent) return false;
  
  if (!purposeConsent.consented) return false;
  if (purposeConsent.withdrawnAt) return false;
  if (purposeConsent.expiresAt && new Date() > purposeConsent.expiresAt) return false;
  
  return true;
};

// Method: Log audit event
gdprComplianceSchema.methods.logAudit = function(eventType, details) {
  this.auditTrail.push({
    timestamp: new Date(),
    eventType,
    ...details
  });
  return this.save();
};

// Method: Export user data (Right to Access)
gdprComplianceSchema.methods.exportData = async function() {
  // This would gather all user data from all collections
  const exportData = {
    personalInfo: {},
    activityData: {},
    preferences: {},
    // ... gather from all relevant collections
  };
  
  // Log the export
  await this.logAudit('data_exported', {
    actor: { type: 'user', id: this.userId },
    purpose: 'data_portability',
    legalBasis: 'consent',
  });
  
  return exportData;
};

// Method: Anonymize user data
gdprComplianceSchema.methods.anonymize = async function() {
  // Mark as anonymized
  this.retention.anonymized = true;
  this.retention.anonymizedAt = new Date();
  this.retention.anonymizationMethod = 'pseudonymization';
  
  // Log the anonymization
  await this.logAudit('data_deleted', {
    actor: { type: 'system', id: 'anonymization_job' },
    purpose: 'data_minimization',
    legalBasis: 'legal_obligation',
  });
  
  await this.save();
};

// Static method: Find users due for deletion
gdprComplianceSchema.statics.findDueForDeletion = async function() {
  return await this.find({
    'retention.scheduledDeletionDate': { $lte: new Date() },
    'retention.anonymized': false,
    'retention.legalHolds': { $size: 0 }
  });
};

// Static method: Generate compliance report
gdprComplianceSchema.statics.generateComplianceReport = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        consentGiven: { 
          $sum: { $cond: [{ $eq: ['$consent.status', 'given'] }, 1, 0] }
        },
        consentWithdrawn: {
          $sum: { $cond: [{ $eq: ['$consent.status', 'withdrawn'] }, 1, 0] }
        },
        accessRequests: { $sum: { $size: '$rights.access' } },
        erasureRequests: { $sum: { $size: '$rights.erasure' } },
        breaches: { $sum: { $size: '$breaches' } },
        compliant: {
          $sum: { $cond: [{ $eq: ['$compliance.status', 'compliant'] }, 1, 0] }
        },
      }
    }
  ]);
};

const GDPRCompliance = mongoose.models.GDPRCompliance || 
  mongoose.model("GDPRCompliance", gdprComplianceSchema, "gdprCompliance");

export default GDPRCompliance;

