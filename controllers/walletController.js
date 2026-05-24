import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import Transaction from "../models/Transaction.model.js";

export const depositFunds = async (req, res) => {
  return res.status(403).json({ 
    success: false, 
    message: "Direct deposits are currently disabled. Tokens must be earned via platform activities." 
  });
};

export const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance");
    res.status(200).json({ success: true, walletBalance: user.walletBalance || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const transactions = await TokenTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
