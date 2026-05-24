import Payout from "../models/Payout.model.js";
import Transaction from "../models/Transaction.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

/**
 * Get craftsman's payout summary
 */
export const getPayoutSummary = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const user = await User.findById(userId).select(
      "totalEarnings totalPaidOut pendingPayout minimumPayoutThreshold payoutEnabled payoutMethod"
    );

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Get pending transactions
    const pendingTransactions = await Transaction.find({
      craftsman: userId,
      status: "completed",
      payoutStatus: "pending",
    })
      .select("amount craftsmanAmount createdAt artifact")
      .populate("artifact", "title");

    // Get recent payouts
    const recentPayouts = await Payout.find({ craftsman: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("amount status createdAt processedAt");

    const canRequestPayout = user.pendingPayout >= user.minimumPayoutThreshold;

    res.status(200).json({
      success: true,
      summary: {
        totalEarnings: user.totalEarnings || 0,
        totalPaidOut: user.totalPaidOut || 0,
        pendingPayout: user.pendingPayout || 0,
        minimumThreshold: user.minimumPayoutThreshold || 50,
        canRequestPayout,
        payoutEnabled: user.payoutEnabled || false,
        payoutMethod: user.payoutMethod || "internal_wallet",
      },
      pendingTransactions: pendingTransactions || [],
      recentPayouts: recentPayouts || [],
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to fetch payout summary", 500));
  }
};

/**
 * Request payout (craftsman)
 */
export const requestPayout = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if payout is enabled
    if (!user.payoutEnabled) {
      return next(new AppError("Payout is not enabled for your account", 403));
    }

    // Check minimum threshold
    if (user.pendingPayout < user.minimumPayoutThreshold) {
      return next(
        new AppError(
          `Minimum payout threshold is ${user.minimumPayoutThreshold} ${
            user.currency || "TKNS"
          }. Your pending payout is ${user.pendingPayout}`,
          400
        )
      );
    }

    // Check if there's already a pending payout
    const existingPayout = await Payout.findOne({
      craftsman: userId,
      status: { $in: ["pending", "processing"] },
    });

    if (existingPayout) {
      return next(
        new AppError("You already have a pending payout request", 400)
      );
    }

    // Get all pending transactions
    const pendingTransactions = await Transaction.find({
      craftsman: userId,
      status: "completed",
      payoutStatus: "pending",
    });

    if (pendingTransactions.length === 0) {
      return next(new AppError("No pending transactions to payout", 400));
    }

    // Create payout
    const payout = await Payout.create({
      craftsman: userId,
      amount: user.pendingPayout,
      currency: "TKNS",
      transactions: pendingTransactions.map((t) => t._id),
      payoutMethod: user.payoutMethod || "internal_wallet",
      bankDetails: user.bankDetails,
      status: "pending",
      minimumThreshold: user.minimumPayoutThreshold,
    });

    // Update transaction payout status
    await Transaction.updateMany(
      { _id: { $in: pendingTransactions.map((t) => t._id) } },
      {
        payoutStatus: "processing",
        payoutId: payout._id,
      }
    );

    res.status(201).json({
      success: true,
      message: "Payout request created successfully",
      payout: {
        id: payout._id,
        amount: payout.amount,
        status: payout.status,
        createdAt: payout.createdAt,
      },
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to create payout request", 500));
  }
};

/**
 * Update payout settings (craftsman)
 */
export const updatePayoutSettings = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { payoutMethod, bankDetails, minimumPayoutThreshold } =
      req.body;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Update payout settings
    if (payoutMethod !== undefined) {
      user.payoutMethod = payoutMethod;
    }

    if (bankDetails !== undefined) {
      user.bankDetails = bankDetails;
    }

    if (minimumPayoutThreshold !== undefined) {
      user.minimumPayoutThreshold = minimumPayoutThreshold;
    }

    // Auto-enable payout if internal wallet is set (or other criteria)
    if (payoutMethod === "internal_wallet") {
      user.payoutEnabled = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Payout settings updated successfully",
      settings: {
        payoutMethod: user.payoutMethod,
        payoutEnabled: user.payoutEnabled,
        minimumPayoutThreshold: user.minimumPayoutThreshold,
      },
    });
  } catch (error) {
    next(
      new AppError(error.message || "Failed to update payout settings", 500)
    );
  }
};

/**
 * Get all payouts (admin only)
 */
export const getAllPayouts = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== "admin" && !req.user?.isSuperAdmin) {
      return next(new AppError("Admin access required", 403));
    }

    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) {
      query.status = status;
    }

    const payouts = await Payout.find(query)
      .populate("craftsman", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payout.countDocuments(query);

    res.status(200).json({
      success: true,
      count: payouts.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      payouts,
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to fetch payouts", 500));
  }
};

/**
 * Process payout (admin only) - Mark as completed
 */
export const processPayout = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== "admin" && !req.user?.isSuperAdmin) {
      return next(new AppError("Admin access required", 403));
    }

    const { payoutId } = req.params;
    const { externalReference, notes } = req.body;

    const payout = await Payout.findById(payoutId).populate("craftsman");

    if (!payout) {
      return next(new AppError("Payout not found", 404));
    }

    if (payout.status === "completed") {
      return next(new AppError("Payout already completed", 400));
    }

    // Update payout status
    payout.status = "completed";
    payout.processedAt = new Date();
    payout.processedBy = req.user._id;
    if (externalReference) payout.externalReference = externalReference;
    if (notes) payout.notes = notes;

    await payout.save();

    // Update transactions
    await Transaction.updateMany(
      { payoutId: payout._id },
      { payoutStatus: "paid" }
    );

    // Update craftsman's total paid out and reset pending
    const craftsman = await User.findById(payout.craftsman._id);
    if (craftsman) {
      craftsman.totalPaidOut = (craftsman.totalPaidOut || 0) + payout.amount;
      craftsman.pendingPayout = Math.max(
        0,
        (craftsman.pendingPayout || 0) - payout.amount
      );
      await craftsman.save();
    }

    res.status(200).json({
      success: true,
      message: "Payout processed successfully",
      payout,
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to process payout", 500));
  }
};

/**
 * Cancel payout (admin only)
 */
export const cancelPayout = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== "admin" && !req.user?.isSuperAdmin) {
      return next(new AppError("Admin access required", 403));
    }

    const { payoutId } = req.params;
    const { reason } = req.body;

    const payout = await Payout.findById(payoutId);

    if (!payout) {
      return next(new AppError("Payout not found", 404));
    }

    if (payout.status === "completed") {
      return next(new AppError("Cannot cancel completed payout", 400));
    }

    // Update payout status
    payout.status = "cancelled";
    if (reason) payout.notes = reason;
    await payout.save();

    // Revert transaction payout status
    await Transaction.updateMany(
      { payoutId: payout._id },
      {
        payoutStatus: "pending",
        payoutId: null,
      }
    );

    res.status(200).json({
      success: true,
      message: "Payout cancelled successfully",
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to cancel payout", 500));
  }
};

