import VerificationRequest from "../models/VerificationRequest.model.js";
import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import logger from "../utils/logger.js";


/**
 * Submit a verification request with strict requirements
 * @route POST /api/v1/verification/apply
 * @access Private
 */
export const submitVerificationRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // --- 0. TIER 1 REWARD (Email/Phone) ---
    // If email is verified and Tier 1 reward not yet granted
    if (user.emailVerified && !user.verificationGrants?.tier1Awarded) {
       const amount = user.role === 'patron' ? 10 : 5;
       
       // 🚀 ATOMIC UPDATE: Prevent double-rewarding via concurrent requests
       const updatedUser = await User.findOneAndUpdate(
         { _id: userId, "verificationGrants.tier1Awarded": false, emailVerified: true },
         { 
           $inc: { walletBalance: amount, totalEarnings: amount },
           $set: { "verificationGrants.tier1Awarded": true }
         },
         { new: true }
       );

       if (updatedUser) {
         await TokenTransaction.create({
            user: userId,
            amount,
            type: "reward",
            source: "verification_tier_1",
            description: "Identity Foundation: Contact Verification Reward",
            metadata: { tier: 1 }
         });
       }
    }

    // --- 1. CRITICAL ELIGIBILITY AUDIT ---
    const checks = {
      profileComplete: !!(user.profilePicture && user.name && user.email),
      bioQuality: !!(user.bio && user.bio.length >= 50),
      accountAge: (Date.now() - new Date(user.createdAt)) > (3 * 24 * 60 * 60 * 1000), // Min 3 days old
      securityStatus: user.isSuspended !== true,
      contactVerified: user.isEmailVerified !== false
    };

    const failed = Object.entries(checks).filter(([_, passed]) => !passed);

    if (failed.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Your profile does not meet the minimum 'High-Trust' criteria for authorization.",
        failedRequirements: failed.map(([key]) => key),
        instructions: "Please ensure your profile is complete, has a high-quality bio (min 50 chars), and your account is at least 3 days old."
      });
    }

    // --- 2. DUPLICATE PROTECTION ---
    const existingRequest = await VerificationRequest.findOne({ 
      user: userId, 
      status: { $in: ["pending", "in_review", "approved"] } 
    });

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: "An active verification request or approved badge already exists for this identity." 
      });
    }

    const {
      category,
      legalName,
      idType,
      idNumber,
      idDocumentFront,
      idDocumentBack,
      selfieWithId,
      rulesAgreed // New requirement: User must explicitly agree to platform rules
    } = req.body;

    if (!rulesAgreed) {
       return res.status(400).json({
         success: false,
         message: "You must explicitly agree to the Platform Code of Conduct to proceed."
       });
    }

    // --- 3. PERSISTENCE ---
    const request = await VerificationRequest.create({
      user: userId,
      category: category || 'identity',
      legalName,
      idType,
      idNumber,
      idDocumentFront,
      idDocumentBack,
      selfieWithId,
      status: 'pending'
    });

    // Update user status
    await User.findByIdAndUpdate(userId, { 
      verificationStatus: "pending" 
    });

    res.status(201).json({
      success: true,
      message: "Identity dossier submitted for forensic audit. Our team will review your profile shortly.",
      data: request
    });

  } catch (error) {
    logger.error("Submit Verification Error:", error);
    res.status(500).json({ success: false, message: "Forensic submission failed. Please try again." });
  }
};

/**
 * Get current user's verification status
 */
export const getMyVerificationStatus = async (req, res) => {
  try {
    const request = await VerificationRequest.findOne({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: request || { status: "unverified" }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch status" });
  }
};

/**
 * [ADMIN] List all verification requests
 */
export const getAllRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status } = req.query;
    
    const query = status ? { status } : {};
    
    const total = await VerificationRequest.countDocuments(query);
    const requests = await VerificationRequest.find(query)
      .populate("user", "name email profilePicture role createdAt isVerified verificationStatus location device browser bio")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
};

/**
 * [ADMIN] Review a verification request
 */
export const reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, rejectionReason } = req.body;

    if (!["approved", "rejected", "in_review"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const request = await VerificationRequest.findByIdAndUpdate(id, {
      status,
      adminNotes,
      rejectionReason,
      reviewedAt: Date.now(),
      reviewedBy: req.user._id
    }, { new: true });

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    // If approved, update the user model
    if (status === "approved") {
      await User.findByIdAndUpdate(request.user, {
        isVerified: true,
        verificationStatus: "approved"
      });
      // Award XP and Tokens for Identity Verification

    } else if (status === "rejected") {
      await User.findByIdAndUpdate(request.user, {
        isVerified: false,
        verificationStatus: "rejected"
      });
    }

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: request
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to review request" });
  }
};

/**
 * @desc Verify professional link (Tier 2) and award tokens
 * @route POST /api/v1/verification/professional-link
 */
export const verifyProfessionalLink = async (req, res) => {
  try {
    const { platform, url } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!['linkedin', 'github', 'portfolio'].includes(platform)) {
      return res.status(400).json({ success: false, message: "Invalid platform" });
    }

    if (user.verificationGrants?.tier2Awarded) {
      return res.status(400).json({ success: false, message: "Professional link reward already claimed." });
    }

    // 🔒 SECURITY FIX: Validate URL actually belongs to the declared platform domain
    // O(1) map lookup — prevents fake URL injection for reward farming
    const PLATFORM_DOMAINS = {
      linkedin: 'linkedin.com',
      github: 'github.com',
      portfolio: null // any valid URL accepted for personal portfolio
    };

    let parsedUrl;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ success: false, message: "Please provide a valid URL." });
    }

    const requiredDomain = PLATFORM_DOMAINS[platform];
    if (requiredDomain && !parsedUrl.hostname.replace('www.', '').endsWith(requiredDomain)) {
      return res.status(400).json({ 
        success: false, 
        message: `URL must be a valid ${platform} profile link (e.g. https://${requiredDomain}/in/yourprofile).` 
      });
    }


    // 🚀 ATOMIC UPDATE: Prevent double-rewarding
    const rewardAmount = 20;
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, "verificationGrants.tier2Awarded": false },
      { 
        $inc: { walletBalance: rewardAmount, totalEarnings: rewardAmount },
        $set: { 
          "verificationGrants.tier2Awarded": true,
          "verificationLevel": "individual",
          [`professionalLinks.${platform}`]: url
        }
      },
      { new: true }
    );

    if (!updatedUser) {
       return res.status(400).json({ success: false, message: "Professional link reward already claimed or processing error." });
    }

    await TokenTransaction.create({
      user: userId,
      amount: rewardAmount,
      type: "reward",
      source: "verification_tier_2",
      description: `Professional Link: ${platform.toUpperCase()} verified`,
      metadata: { tier: 2, platform }
    });

    res.status(200).json({
      success: true,
      message: `Successfully verified ${platform} and awarded ${rewardAmount} T`,
      newBalance: updatedUser.walletBalance
    });

  } catch (error) {
    logger.error("Verify Professional Link Error:", error);
    res.status(500).json({ success: false, message: "Verification failed." });
  }
};

/**
 * @desc Claim profile completion reward (Tier 3)
 * @route POST /api/v1/verification/claim-profile-reward
 */
export const claimProfileReward = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.verificationGrants?.tier3Awarded) {
      return res.status(400).json({ success: false, message: "Profile reward already claimed." });
    }

    // Check if profile is actually 100% (basic check)
    const isComplete = !!(user.bio && user.profilePicture && user.name && user.skills?.length > 0);
    
    if (!isComplete) {
      return res.status(400).json({ 
        success: false, 
        message: "Profile incomplete. Ensure Bio, Picture, and Skills are set.",
        requirements: ["Bio", "Profile Picture", "Skills"]
      });
    }

    const rewardAmount = 10;
    
    // 🚀 ATOMIC UPDATE: Prevent double-rewarding
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, "verificationGrants.tier3Awarded": false },
      { 
        $inc: { walletBalance: rewardAmount, totalEarnings: rewardAmount },
        $set: { "verificationGrants.tier3Awarded": true }
      },
      { new: true }
    );

    if (!updatedUser) {
       return res.status(400).json({ success: false, message: "Profile reward already claimed or processing error." });
    }

    await TokenTransaction.create({
      user: req.user._id,
      amount: rewardAmount,
      type: "reward",
      source: "verification_tier_3",
      description: "Profile Authority: 100% Completion Reward",
      metadata: { tier: 3 }
    });

    res.status(200).json({
      success: true,
      message: `Profile verified. Awarded ${rewardAmount} T`,
      newBalance: updatedUser.walletBalance
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Claim failed." });
  }
};
