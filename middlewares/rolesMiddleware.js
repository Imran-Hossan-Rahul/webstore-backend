// middlewares/rolesMiddleware.js

/**
 * Middleware to require creator account
 * Checks if user has an active creator account
 */
export const requireCreatorAccount = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    // Check if user has creator account
    if (!user.hasCreatorAccount) {
      return res.status(403).json({
        success: false,
        message: "Creator account required. Please create a creator account first.",
      });
    }

    // Optionally verify creator profile exists and is active
    const CreatorProfile = (await import("../models/CreatorProfile.model.js")).default;
    const creatorProfile = await CreatorProfile.findOne({
      userId: user._id,
      isActive: true,
    });

    if (!creatorProfile) {
      return res.status(403).json({
        success: false,
        message: "Creator profile not found or inactive",
      });
    }

    // Attach creator profile to request for easy access
    req.creatorProfile = creatorProfile;
    next();
  } catch (error) {
    console.error("Creator account check error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Legacy middleware for backward compatibility
 * @deprecated Use requireCreatorAccount instead
 */
export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Map old roles to new system
    if (allowedRoles.includes("freelancer") || allowedRoles.includes("engineer")) {
      return requireCreatorAccount(req, res, next);
    }

    // All authenticated users are platform users
    if (allowedRoles.includes("client") || allowedRoles.includes("hirer")) {
      return next();
    }

    return res
      .status(403)
      .json({ success: false, message: "Access denied for this route" });
  };
};
