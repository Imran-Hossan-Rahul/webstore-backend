import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import logger from "../utils/logger.js";

/**
 * @desc    Get user token balance and stats
 * @route   GET /api/v1/tokens/balance
 * @access  Private
 */
export const getTokenBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("walletBalance totalEarnings");
    
    res.status(200).json({
      success: true,
      tokenBalance: user.walletBalance || 0,
      totalEarned: user.totalEarnings || 0
    });
  } catch (err) {
    logger.error("Get token balance error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get user token transaction history
 * @route   GET /api/v1/tokens/history
 * @access  Private
 */
export const getTokenHistory = async (req, res) => {
  try {
    const history = await TokenTransaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    logger.error("Get token history error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Award tokens to a user (Internal or via specific actions)
 * @route   POST /api/v1/tokens/reward
 * @access  Private (Anti-spam applied via middleware)
 */
/**
 * @desc    Award tokens to a user (Internal or via specific actions)
 * @route   POST /api/v1/tokens/reward
 * @access  Private (Anti-spam applied via middleware)
 */
export const rewardTokens = async (req, res) => {
  const { amount, source, description, referenceId } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  try {
    // 1. Atomic Update of Balance
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { 
        $inc: { 
          walletBalance: Number(amount),
          totalEarnings: Number(amount)
        } 
      },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Create Audit Trail
    const transaction = await TokenTransaction.create({
      user: userId,
      amount: Number(amount),
      type: "reward",
      source: source || "manual_reward",
      description: description || "Token reward earned",
      referenceId,
      metadata: {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        previousBalance: updatedUser.walletBalance - Number(amount),
        newBalance: updatedUser.walletBalance
      }
    });

    res.status(200).json({
      success: true,
      message: `${amount} tokens awarded successfully`,
      newBalance: updatedUser.walletBalance,
      transaction
    });
  } catch (err) {
    logger.error("Reward tokens error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
