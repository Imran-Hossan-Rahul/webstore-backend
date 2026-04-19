import ButtonTemplate from "../models/Template.model.js";
import Transaction from "../models/Transaction.model.js";
import AppError from "../utils/AppError.js";

/**
 * Download template controller
 * Handles both free and paid template downloads
 */
export const downloadTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?._id || req.user?.id;

    const template = await ButtonTemplate.findById(templateId);

    if (!template) {
      return next(new AppError("Template not found", 404));
    }

    // Free template → direct download (no auth required)
    if (template.priceType === "free") {
      // Increment download count
      await template.incrementDownloads(1, userId);
      return res.status(200).json({
        success: true,
        url: template.projectFile,
        free: true,
      });
    }

    // Paid template → user must be logged in
    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Login & purchase required for paid templates",
        paid: true,
        requiresAuth: true,
      });
    }

    // Check if user already purchased (check both template.purchasedBy and Transaction)
    const hasPurchasedInTemplate = template.purchasedBy.some(
      (id) => id.toString() === userId.toString()
    );

    // Also check transaction record for extra security
    const hasValidTransaction = await Transaction.findOne({
      buyer: userId,
      template: templateId,
      status: "completed",
    });

    const hasPurchased = hasPurchasedInTemplate || !!hasValidTransaction;

    if (!hasPurchased) {
      // Calculate final price with discount
      const finalPrice =
        template.discount > 0
          ? template.price * (1 - template.discount / 100)
          : template.price;

      return res.status(403).json({
        success: false,
        message: "Please purchase this template before downloading",
        paid: true,
        requiresPurchase: true,
        templateId,
        price: template.price,
        finalPrice: Math.round(finalPrice * 100) / 100,
        discount: template.discount || 0,
        currency: template.currency || "USD",
        title: template.title,
        thumbnail: template.thumbnailSource,
      });
    }

    // User purchased → allow download
    await template.incrementDownloads(1, userId);
    return res.status(200).json({
      success: true,
      url: template.projectFile,
      purchased: true,
    });
  } catch (error) {
    console.error("Download template error:", error);
    next(new AppError(error.message || "Failed to process download", 500));
  }
};

/**
 * Confirm purchase endpoint (legacy - kept for backward compatibility)
 * Note: This is now handled by Stripe webhook, but kept for manual confirmation if needed
 */
export const confirmPurchase = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Login required", 401));
    }

    const template = await ButtonTemplate.findById(templateId);

    if (!template) {
      return next(new AppError("Template not found", 404));
    }

    // Check if already purchased
    if (template.purchasedBy.includes(userId)) {
      return res.status(200).json({
        success: true,
        message: "Purchase already confirmed",
      });
    }

    // Check for valid transaction
    const transaction = await Transaction.findOne({
      buyer: userId,
      template: templateId,
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
    if (!template.purchasedBy.includes(userId)) {
      template.purchasedBy.push(userId);
      template.salesCount = (template.salesCount || 0) + 1;
      await template.save();
    }

    res.status(200).json({
      success: true,
      message: "Purchase confirmed",
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to confirm purchase", 500));
  }
};
