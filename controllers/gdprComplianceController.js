// controllers/gdprComplianceController.js
// GDPR & Privacy Compliance Management
import asyncHandler from "express-async-handler";
import GDPRCompliance from "../models/GDPRCompliance.model.js";
import User from "../models/User.model.js";

/**
 * @desc    Get user GDPR compliance data
 * @route   GET /api/v1/gdpr/:userId
 * @access  Admin / User (own data)
 */
export const getGDPRCompliance = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const authenticatedUserId = req.user.id || req.user._id?.toString();
  if (authenticatedUserId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  let gdprData = await GDPRCompliance.findOne({ userId });

  if (!gdprData) {
    // Create initial GDPR record
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    gdprData = await GDPRCompliance.create({
      userId,
      email: user.email,
      consent: {
        status: 'pending',
        purposes: [],
      },
    });
  }

  res.status(200).json({ success: true, data: gdprData });
});

/**
 * @desc    Update consent
 * @route   POST /api/v1/gdpr/:userId/consent
 * @access  User (own data)
 */
export const updateConsent = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { purposes } = req.body;

  if ((req.user.id || req.user._id?.toString()) !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  // Update consents
  purposes.forEach(purpose => {
    const existing = gdprData.consent.purposes.find(p => p.purpose === purpose.purpose);
    if (existing) {
      existing.consented = purpose.consented;
      existing.consentedAt = purpose.consented ? new Date() : existing.consentedAt;
      existing.withdrawnAt = !purpose.consented ? new Date() : null;
      existing.history.push({
        action: purpose.consented ? 'given' : 'withdrawn',
        timestamp: new Date(),
        ipAddress: req.ip,
      });
    } else {
      gdprData.consent.purposes.push({
        purpose: purpose.purpose,
        consented: purpose.consented,
        consentedAt: purpose.consented ? new Date() : null,
        legalBasis: 'consent',
        consentMethod: 'explicit',
        consentSource: 'web',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        history: [{
          action: purpose.consented ? 'given' : 'withdrawn',
          timestamp: new Date(),
          ipAddress: req.ip,
        }],
      });
    }
  });

  gdprData.consent.status = 'given';
  await gdprData.save();

  // Log audit
  await gdprData.logAudit('consent_given', {
    actor: { type: 'user', id: userId },
    purpose: 'consent_management',
    legalBasis: 'consent',
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, data: gdprData });
});

/**
 * @desc    Request data access (Codex 15)
 * @route   POST /api/v1/gdpr/:userId/access
 * @access  User (own data)
 */
export const requestDataAccess = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if ((req.user.id || req.user._id?.toString()) !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  const requestId = `access_${Date.now()}`;

  gdprData.rights.access.push({
    requestedAt: new Date(),
    requestId,
    status: 'pending',
  });

  await gdprData.save();

  // Log audit
  await gdprData.logAudit('data_accessed', {
    actor: { type: 'user', id: userId },
    purpose: 'data_portability',
    legalBasis: 'legal_obligation',
    ipAddress: req.ip,
  });

  // In production, trigger background job to generate export
  // For now, return request ID
  res.status(200).json({ 
    success: true, 
    message: "Data access request submitted. You will receive an email when ready.",
    requestId 
  });
});

/**
 * @desc    Request data erasure (Codex 17)
 * @route   POST /api/v1/gdpr/:userId/erasure
 * @access  User (own data)
 */
export const requestDataErasure = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason, scope } = req.body;

  if ((req.user.id || req.user._id?.toString()) !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  const requestId = `erasure_${Date.now()}`;

  gdprData.rights.erasure.push({
    requestedAt: new Date(),
    requestId,
    status: 'pending',
    scope: scope || 'full',
    verificationRequired: true,
    verified: false,
  });

  await gdprData.save();

  // Log audit
  await gdprData.logAudit('data_deleted', {
    actor: { type: 'user', id: userId },
    purpose: 'data_minimization',
    legalBasis: 'legal_obligation',
    ipAddress: req.ip,
  });

  res.status(200).json({ 
    success: true, 
    message: "Data erasure request submitted. Verification email sent.",
    requestId 
  });
});

/**
 * @desc    Request data portability (Codex 20)
 * @route   POST /api/v1/gdpr/:userId/portability
 * @access  User (own data)
 */
export const requestDataPortability = asyncHandler(async (req, res) => {
  const userId = req.params.userId || (req.user.id || req.user._id?.toString());
  const { format } = req.body;

  if ((req.user.id || req.user._id?.toString()) !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  const requestId = `portability_${Date.now()}`;

  gdprData.rights.portability.push({
    requestedAt: new Date(),
    requestId,
    status: 'pending',
    format: format || 'json',
  });

  await gdprData.save();

  res.status(200).json({ 
    success: true, 
    message: "Data portability request submitted.",
    requestId 
  });
});

/**
 * @desc    Object to processing (Codex 21)
 * @route   POST /api/v1/gdpr/:userId/object
 * @access  User (own data)
 */
export const objectToProcessing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { processingType, reason } = req.body;

  if ((req.user.id || req.user._id?.toString()) !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  const requestId = `objection_${Date.now()}`;

  gdprData.rights.objection.push({
    requestedAt: new Date(),
    requestId,
    status: 'pending',
    processingType,
    reason,
  });

  await gdprData.save();

  res.status(200).json({ 
    success: true, 
    message: "Objection submitted.",
    requestId 
  });
});

/**
 * @desc    Get compliance report
 * @route   GET /api/v1/gdpr/report
 * @access  Admin
 */
export const getComplianceReport = asyncHandler(async (req, res) => {
  const report = await GDPRCompliance.generateComplianceReport();

  res.status(200).json({ success: true, data: report[0] || {} });
});

/**
 * @desc    Find users due for deletion
 * @route   GET /api/v1/gdpr/due-for-deletion
 * @access  Admin
 */
export const getUsersDueForDeletion = asyncHandler(async (req, res) => {
  const users = await GDPRCompliance.findDueForDeletion();

  res.status(200).json({ success: true, data: users });
});

/**
 * @desc    Process data erasure request
 * @route   POST /api/v1/gdpr/process-erasure/:requestId
 * @access  Admin
 */
export const processErasureRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  const gdprData = await GDPRCompliance.findOne({ 'rights.erasure.requestId': requestId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "Request not found" });
  }

  const request = gdprData.rights.erasure.find(r => r.requestId === requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: "Request not found" });
  }

  if (action === 'approve') {
    request.status = 'completed';
    request.completedAt = new Date();
    request.verified = true;
    request.deletionMethod = 'soft_delete';
    request.deletedAt = new Date();

    // In production, trigger actual deletion
    // For now, just mark as deleted
    await gdprData.anonymize();

    res.status(200).json({ success: true, message: "Erasure request approved and processed" });
  } else {
    request.status = 'rejected';
    request.rejectionReason = req.body.reason || 'Legal obligation to retain data';

    await gdprData.save();

    res.status(200).json({ success: true, message: "Erasure request rejected" });
  }
});

/**
 * @desc    Export user data
 * @route   GET /api/v1/gdpr/:userId/export
 * @access  User (own data) / Admin
 */
export const exportUserData = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if ((req.user.id || req.user._id?.toString()) !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  const gdprData = await GDPRCompliance.findOne({ userId });
  if (!gdprData) {
    return res.status(404).json({ success: false, message: "GDPR data not found" });
  }

  // Export all user data
  const exportData = await gdprData.exportData();

  res.status(200).json({ success: true, data: exportData });
});

/**
 * @desc    Request data export (Frontend 'Request Archive' button)
 * @route   POST /api/v1/gdpr/export-request
 * @access  User
 */
export const requestExport = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id?.toString();
  
  let gdprData = await GDPRCompliance.findOne({ userId });
  
  if (!gdprData) {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    gdprData = await GDPRCompliance.create({
      userId,
      email: user.email,
      consent: { status: 'pending', purposes: [] }
    });
  }

  const requestId = `export_${Date.now()}`;

  gdprData.rights.portability.push({
    requestedAt: new Date(),
    requestId,
    status: 'pending',
    format: 'json'
  });

  await gdprData.save();

  res.status(200).json({ 
    success: true, 
    message: "Data export request submitted. Processing takes up to 24 hours.",
    requestId 
  });
});

