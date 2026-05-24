import Artifact from "../models/Artifact.model.js";
import Transaction from "../models/Transaction.model.js";
import AppError from "../utils/AppError.js";

/**
 * Download artifact controller
 * Handles both free and paid artifact downloads
 */
export const downloadArtifact = async (req, res, next) => {
  try {
    const { artifactId } = req.params;
    const userId = req.user?._id || req.user?.id;

    const artifact = await Artifact.findById(artifactId);

    if (!artifact) {
      return next(new AppError("Artifact not found", 404));
    }

    // Free artifact → direct download (no auth required)
    if (artifact.priceType === "free") {
      // Increment download count
      await artifact.incrementDownloads(1, userId);
      return res.status(200).json({
        success: true,
        url: artifact.devlogFile,
        free: true,
      });
    }

    // Paid artifact → user must be logged in
    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Login & purchase required for paid artifacts",
        paid: true,
        requiresAuth: true,
      });
    }

    // Check if user already purchased (check both artifact.purchasedBy and Transaction)
    const hasPurchasedInArtifact = artifact.purchasedBy.some(
      (id) => id.toString() === userId.toString()
    );

    // Also check transaction record for extra security
    const hasValidTransaction = await Transaction.findOne({
      buyer: userId,
      artifact: artifactId,
      status: "completed",
    });

    const hasPurchased = hasPurchasedInArtifact || !!hasValidTransaction;

    if (!hasPurchased) {
      // Calculate final price with discount
      const finalPrice =
        artifact.discount > 0
          ? artifact.price * (1 - artifact.discount / 100)
          : artifact.price;

      return res.status(403).json({
        success: false,
        message: "Please purchase this artifact before downloading",
        paid: true,
        requiresPurchase: true,
        artifactId,
        price: artifact.price,
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: artifact.discount || 0,
        currency: artifact.currency || "TKNS",
        title: artifact.title,
        thumbnail: artifact.thumbnailSource,
      });
    }

    // User purchased → allow download
    await artifact.incrementDownloads(1, userId);
    return res.status(200).json({
      success: true,
      url: artifact.devlogFile,
      purchased: true,
    });
  } catch (error) {
    console.error("Download artifact error:", error);
    next(new AppError(error.message || "Failed to process download", 500));
  }
};

/**
 * Confirm purchase endpoint (legacy - kept for backward compatibility)
 * Note: This is now handled by Stripe webhook, but kept for manual confirmation if needed
 */
export const confirmPurchase = async (req, res, next) => {
  try {
    const { artifactId } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Login required", 401));
    }

    const artifact = await Artifact.findById(artifactId);

    if (!artifact) {
      return next(new AppError("Artifact not found", 404));
    }

    // Check if already purchased
    if (artifact.purchasedBy.includes(userId)) {
      return res.status(200).json({
        success: true,
        message: "Purchase already confirmed",
      });
    }

    // Check for valid transaction
    const transaction = await Transaction.findOne({
      buyer: userId,
      artifact: artifactId,
      status: "completed",
    });

    if (!transaction) {
      return next(
        new AppError(
          "No valid purchase found. Please complete payment first.",
          400
        )
      );
    }

    // Add to purchasedBy array
    if (!artifact.purchasedBy.includes(userId)) {
      artifact.purchasedBy.push(userId);
      artifact.salesCount = (artifact.salesCount || 0) + 1;
      await artifact.save();
    }

    res.status(200).json({
      success: true,
      message: "Purchase confirmed",
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to confirm purchase", 500));
  }
};


