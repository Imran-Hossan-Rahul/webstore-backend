import Transaction from "../models/Transaction.model.js";
import ButtonTemplate from "../models/Template.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

const PLATFORM_COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION || "30");

/**
 * Calculate platform and creator amounts
 */
export function calculateAmounts(
  totalAmount,
  commissionPercent = PLATFORM_COMMISSION
) {
  const platformAmount =
    Math.round(((totalAmount * commissionPercent) / 100) * 100) / 100;
  const creatorAmount = Math.round((totalAmount - platformAmount) * 100) / 100;
  return { platformAmount, creatorAmount };
}

/**
 * Create transaction record
 */
export async function createTransaction({
  buyerId,
  templateId,
  creatorId,
  amount,
  currency = "USD",
  paymentMethod = "stripe",
  paymentData = {},
}) {
  const { platformAmount, creatorAmount } = calculateAmounts(amount);

  const transaction = await Transaction.create({
    buyer: buyerId,
    template: templateId,
    creator: creatorId,
    amount,
    currency,
    platformCommission: PLATFORM_COMMISSION,
    platformAmount,
    creatorAmount,
    paymentMethod,
    status: paymentMethod === "manual" ? "verifying" : "pending",
    requiresVerification: paymentMethod === "manual",
    ...paymentData,
  });

  return transaction;
}

/**
 * Complete transaction and unlock template
 */
export async function completeTransaction(transactionId, verifiedBy = null) {
  const transaction = await Transaction.findById(transactionId).populate(
    "template"
  );

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  if (transaction.status === "completed") {
    return transaction; // Already completed
  }

  // Update transaction status
  transaction.status = "completed";
  if (verifiedBy) {
    transaction.verifiedBy = verifiedBy;
    transaction.verifiedAt = new Date();
  }
  await transaction.save();

  // Add buyer to template's purchasedBy array
  const template = await ButtonTemplate.findById(
    transaction.template._id || transaction.template
  );
  if (template && !template.purchasedBy.includes(transaction.buyer)) {
    template.purchasedBy.push(transaction.buyer);
    template.salesCount = (template.salesCount || 0) + 1;
    await template.save();
  }

  // Update creator's earnings
  const creator = await User.findById(transaction.creator);
  if (creator) {
    creator.totalEarnings =
      (creator.totalEarnings || 0) + transaction.creatorAmount;
    creator.pendingPayout =
      (creator.pendingPayout || 0) + transaction.creatorAmount;
    await creator.save();
  }

  return transaction;
}

/**
 * Generate Payoneer payment link
 * Note: This is a placeholder - you'll need to integrate with Payoneer API
 * or generate a payment request link manually
 */
export function generatePayoneerPaymentLink(
  amount,
  currency,
  description,
  returnUrl
) {
  // Payoneer API integration would go here
  // For now, return instructions for manual payment

  const payoneerEmail =
    process.env.PAYONEER_RECEIVE_EMAIL || "your-payoneer@email.com";

  return {
    method: "payoneer",
    instructions: `Please send ${amount} ${currency} to Payoneer email: ${payoneerEmail}`,
    payoneerEmail,
    amount,
    currency,
    description,
    returnUrl,
    // In production, you would generate an actual Payoneer payment link here
    // paymentLink: `https://payoneer.com/paylink?token=...`
  };
}

/**
 * Get available payment methods based on user location/currency
 */
export function getAvailablePaymentMethods(
  currency = "USD",
  userCountry = null
) {
  const methods = [];

  // Stripe (if available)
  if (process.env.STRIPE_SECRET_KEY) {
    methods.push({
      id: "stripe",
      name: "Credit/Debit Card (Stripe)",
      icon: "💳",
      available: true,
      supportedCurrencies: [
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "JPY",
        "SGD",
        "HKD",
      ],
    });
  }

  // Payoneer
  if (process.env.PAYONEER_RECEIVE_EMAIL) {
    methods.push({
      id: "payoneer",
      name: "Payoneer",
      icon: "🌍",
      available: true,
      supportedCurrencies: ["USD", "EUR", "GBP"],
    });
  }

  // Manual payment methods (Bangladesh)
  if (userCountry === "BD" || currency === "BDT") {
    methods.push(
      {
        id: "bkash",
        name: "bKash",
        icon: "📱",
        available: true,
        requiresVerification: true,
        supportedCurrencies: ["BDT", "USD"],
      },
      {
        id: "nagad",
        name: "Nagad",
        icon: "📱",
        available: true,
        requiresVerification: true,
        supportedCurrencies: ["BDT", "USD"],
      },
      {
        id: "rocket",
        name: "Rocket (DBBL)",
        icon: "📱",
        available: true,
        requiresVerification: true,
        supportedCurrencies: ["BDT", "USD"],
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        icon: "🏦",
        available: true,
        requiresVerification: true,
        supportedCurrencies: ["BDT", "USD"],
      }
    );
  }

  // SSLCommerz (Bangladesh gateway)
  if (
    process.env.SSLCOMMERZ_STORE_ID &&
    (userCountry === "BD" || currency === "BDT")
  ) {
    methods.push({
      id: "sslcommerz",
      name: "SSLCommerz",
      icon: "💳",
      available: true,
      supportedCurrencies: ["BDT"],
    });
  }

  // Aamarpay (Bangladesh gateway)
  if (
    process.env.AAMARPAY_STORE_ID &&
    (userCountry === "BD" || currency === "BDT")
  ) {
    methods.push({
      id: "aamarpay",
      name: "Aamarpay",
      icon: "💳",
      available: true,
      supportedCurrencies: ["BDT"],
    });
  }

  return methods;
}
