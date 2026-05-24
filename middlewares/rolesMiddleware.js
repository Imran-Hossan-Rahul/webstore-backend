// middlewares/rolesMiddleware.js

/**
 * Middleware to require craftsman account
 * Checks if user has an active craftsman account
 */
export const requireCraftsmanAccount = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
    }

    // Check if user has craftsman account
    if (!user.hasCraftsmanAccount) {
      return res.status(403).json({
        success: false,
        message: "Craftsman account required. Please create a craftsman account first.",
      });
    }

    // Optionally verify craftsman profile exists and is active
    const CraftsmanProfile = (await import("../models/CraftsmanProfile.model.js")).default;
    const craftsmanProfile = await CraftsmanProfile.findOne({
      userId: user._id,
      isActive: true,
    });

    if (!craftsmanProfile) {
      return res.status(403).json({
        success: false,
        message: "Craftsman profile not found or inactive",
      });
    }

    // Attach craftsman profile to request for easy access
    req.craftsmanProfile = craftsmanProfile;
    next();
  } catch (error) {
    console.error("Craftsman account check error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Legacy middleware for backward compatibility
 * @deprecated Use requireCraftsmanAccount instead
 */
export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Map old roles to new system
    if (allowedRoles.includes("craftsman") || allowedRoles.includes("engineer")) {
      return requireCraftsmanAccount(req, res, next);
    }

    // All authenticated users are platform users
    if (allowedRoles.includes("patron") || allowedRoles.includes("hirer")) {
      return next();
    }

    return res
      .status(403)
      .json({ success: false, message: "Access denied for this route" });
  };
};


