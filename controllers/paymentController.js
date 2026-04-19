import Stripe from "stripe";
import ButtonTemplate from "../models/Template.model.js";
import Transaction from "../models/Transaction.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import {
  createTransaction,
  completeTransaction,
  generatePayoneerPaymentLink,
  getAvailablePaymentMethods,
} from "../services/paymentService.js";

// Initialize Stripe only if key exists
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (err) {
    console.warn("Stripe initialization failed:", err.message);
  }
}

// Platform commission percentage (30% = platform, 70% = creator)
const PLATFORM_COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION || "30");

/**
 * Get available payment methods
 */
export const getPaymentMethods = async (req, res, next) => {
  try {
    const { currency = "USD", country } = req.query;
    const userCountry = req.user?.location?.country || country;

    const methods = getAvailablePaymentMethods(currency, userCountry);

    res.status(200).json({
      success: true,
      paymentMethods: methods,
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to fetch payment methods", 500));
  }
};

/**
 * Create payment session for template purchase (supports multiple payment methods)
 */
export const createPaymentSession = async (req, res, next) => {
  try {
    const { templateId, paymentMethod = "stripe" } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    // Get template details
    const template = await ButtonTemplate.findById(templateId).populate("user", "name email");

    if (!template) {
      return next(new AppError("Template not found", 404));
    }

    if (template.priceType === "free") {
      return next(new AppError("This template is free", 400));
    }

    // Check if user already purchased
    const user = await User.findById(userId);
    if (template.purchasedBy.includes(userId)) {
      return res.status(200).json({
        success: true,
        message: "You already own this template",
        alreadyOwned: true,
      });
    }

    const amount = template.discount > 0
      ? template.price * (1 - template.discount / 100)
      : template.price;
    const currency = template.currency || "USD";
    const creatorId = template.user?._id || template.user;

    // Handle different payment methods
    switch (paymentMethod) {
      case "stripe":
        return await handleStripePayment(req, res, next, {
          templateId,
          userId,
          template,
          user,
          amount,
          currency,
          creatorId,
        });

      case "payoneer":
        return await handlePayoneerPayment(req, res, next, {
          templateId,
          userId,
          template,
          user,
          amount,
          currency,
          creatorId,
        });

      case "manual":
      case "bkash":
      case "nagad":
      case "rocket":
      case "bank_transfer":
        return await handleManualPayment(req, res, next, {
          templateId,
          userId,
          template,
          user,
          amount,
          currency,
          creatorId,
          paymentMethod,
        });

      default:
        return next(new AppError(`Payment method '${paymentMethod}' is not supported`, 400));
    }
  } catch (err) {
    console.error("Create payment session error:", err);
    next(new AppError(err.message || "Failed to create payment session", 500));
  }
};

/**
 * Handle Stripe payment
 */
async function handleStripePayment(req, res, next, { templateId, userId, template, user, amount, currency, creatorId }) {
  if (!stripe) {
    return next(new AppError("Stripe is not configured. Please use another payment method.", 400));
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: template.title,
              description: template.description?.substring(0, 200) || "Template purchase",
              images: template.thumbnailSource ? [template.thumbnailSource] : [],
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      customer_email: user.email,
      metadata: {
        templateId: templateId.toString(),
        userId: userId.toString(),
        creatorId: creatorId?.toString(),
        amount: amount.toString(),
        currency,
      },
    });

    // Create pending transaction
    await createTransaction({
      buyerId: userId,
      templateId,
      creatorId,
      amount,
      currency,
      paymentMethod: "stripe",
      paymentData: {
        stripeSessionId: session.id,
      },
    });

    res.status(200).json({
      success: true,
      paymentMethod: "stripe",
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Stripe create session error:", err);
    next(new AppError(err.message || "Failed to create Stripe payment session", 500));
  }
}

/**
 * Handle Payoneer payment
 */
async function handlePayoneerPayment(req, res, next, { templateId, userId, template, user, amount, currency, creatorId }) {
  try {
    const returnUrl = `${process.env.FRONTEND_URL}/payment-success?transaction_id={TRANSACTION_ID}`;
    const paymentLink = generatePayoneerPaymentLink(
      amount,
      currency,
      `Template: ${template.title}`,
      returnUrl
    );

    // Create pending transaction
    const transaction = await createTransaction({
      buyerId: userId,
      templateId,
      creatorId,
      amount,
      currency,
      paymentMethod: "payoneer",
      paymentData: {
        payoneerPaymentLink: paymentLink.paymentLink || null,
        requiresVerification: true,
      },
    });

    res.status(200).json({
      success: true,
      paymentMethod: "payoneer",
      transactionId: transaction._id,
      instructions: paymentLink.instructions,
      payoneerEmail: paymentLink.payoneerEmail,
      amount,
      currency,
      paymentLink: paymentLink.paymentLink || null,
      // User needs to complete payment manually and notify admin
      message: "Please send payment to the Payoneer email above. Your transaction will be verified manually.",
    });
  } catch (err) {
    console.error("Payoneer payment error:", err);
    next(new AppError(err.message || "Failed to create Payoneer payment", 500));
  }
}

/**
 * Handle manual payment (bKash, Nagad, Rocket, Bank Transfer)
 */
async function handleManualPayment(req, res, next, { templateId, userId, template, user, amount, currency, creatorId, paymentMethod }) {
  try {
    // Create transaction with verifying status
    const transaction = await createTransaction({
      buyerId: userId,
      templateId,
      creatorId,
      amount,
      currency,
      paymentMethod,
      paymentData: {
        requiresVerification: true,
        status: "verifying",
      },
    });

    // Get payment instructions based on method
    const instructions = getManualPaymentInstructions(paymentMethod, amount, currency);

    res.status(200).json({
      success: true,
      paymentMethod,
      transactionId: transaction._id,
      amount,
      currency,
      instructions,
      requiresVerification: true,
      message: `Please complete payment via ${paymentMethod.toUpperCase()} and upload proof. Your transaction will be verified within 24 hours.`,
    });
  } catch (err) {
    console.error("Manual payment error:", err);
    next(new AppError(err.message || "Failed to create manual payment", 500));
  }
}

/**
 * Get payment instructions for manual payment methods
 */
function getManualPaymentInstructions(method, amount, currency) {
  const payoneerEmail = process.env.PAYONEER_RECEIVE_EMAIL || "your-payoneer@email.com";
  const bkashNumber = process.env.BKASH_NUMBER || "01XXXXXXXXX";
  const nagadNumber = process.env.NAGAD_NUMBER || "01XXXXXXXXX";
  const rocketNumber = process.env.ROCKET_NUMBER || "01XXXXXXXXX";
  const bankAccount = process.env.BANK_ACCOUNT || "Account Number: XXXX";

  const instructions = {
    bkash: {
      title: "bKash Payment Instructions",
      steps: [
        `1. Send ${amount} ${currency} to bKash: ${bkashNumber}`,
        "2. Save the transaction ID",
        "3. Upload payment proof screenshot",
        "4. Wait for verification (usually within 24 hours)",
      ],
      accountNumber: bkashNumber,
    },
    nagad: {
      title: "Nagad Payment Instructions",
      steps: [
        `1. Send ${amount} ${currency} to Nagad: ${nagadNumber}`,
        "2. Save the transaction ID",
        "3. Upload payment proof screenshot",
        "4. Wait for verification (usually within 24 hours)",
      ],
      accountNumber: nagadNumber,
    },
    rocket: {
      title: "Rocket (DBBL) Payment Instructions",
      steps: [
        `1. Send ${amount} ${currency} to Rocket: ${rocketNumber}`,
        "2. Save the transaction ID",
        "3. Upload payment proof screenshot",
        "4. Wait for verification (usually within 24 hours)",
      ],
      accountNumber: rocketNumber,
    },
    bank_transfer: {
      title: "Bank Transfer Instructions",
      steps: [
        `1. Transfer ${amount} ${currency} to: ${bankAccount}`,
        "2. Save the transaction reference number",
        "3. Upload bank receipt screenshot",
        "4. Wait for verification (usually within 24-48 hours)",
      ],
      accountDetails: bankAccount,
    },
    payoneer: {
      title: "Payoneer Payment Instructions",
      steps: [
        `1. Send ${amount} ${currency} to Payoneer email: ${payoneerEmail}`,
        "2. Include transaction reference in payment note",
        "3. Upload payment confirmation",
        "4. Wait for verification (usually within 24-48 hours)",
      ],
      payoneerEmail,
    },
  };

  return instructions[method] || {
    title: "Payment Instructions",
    steps: [`Please send ${amount} ${currency} and upload proof for verification.`],
  };
}

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req, res) => {
  if (!stripe) {
    return res.status(400).json({ error: "Stripe is not configured" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(400).json({ error: "Stripe webhook secret not configured" });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await handleRefund(event.data.object);
        break;

    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  try {
    const { templateId, userId, creatorId, amount, currency } = session.metadata;

    if (!templateId || !userId) {
      console.error("Missing metadata in checkout session");
      return;
    }

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      stripeSessionId: session.id,
    });

    if (existingTransaction) {
      return;
    }

    // Get template and user
    const template = await ButtonTemplate.findById(templateId);
    const buyer = await User.findById(userId);
    const creator = await User.findById(creatorId || template?.user);

    if (!template || !buyer) {
      console.error("Template or buyer not found");
      return;
    }

    const purchaseAmount = parseFloat(amount);
    const platformCommission = PLATFORM_COMMISSION;
    const platformAmount = (purchaseAmount * platformCommission) / 100;
    const creatorAmount = purchaseAmount - platformAmount;

    // Create transaction record
    const transaction = await Transaction.create({
      buyer: userId,
      template: templateId,
      creator: creator?._id || template.user,
      amount: purchaseAmount,
      currency: currency || "USD",
      platformCommission: platformCommission,
      platformAmount: Math.round(platformAmount * 100) / 100,
      creatorAmount: Math.round(creatorAmount * 100) / 100,
      paymentMethod: "stripe",
      stripePaymentIntentId: session.payment_intent,
      stripeSessionId: session.id,
      status: "completed",
      payoutStatus: "pending",
      metadata: {
        customerEmail: session.customer_email,
        customerName: session.customer_details?.name,
      },
    });

    // Add buyer to template's purchasedBy array
    if (!template.purchasedBy.includes(userId)) {
      template.purchasedBy.push(userId);
      template.salesCount = (template.salesCount || 0) + 1;
      await template.save();
    }

    // Update creator's earnings
    if (creator) {
      creator.totalEarnings = (creator.totalEarnings || 0) + creatorAmount;
      creator.pendingPayout = (creator.pendingPayout || 0) + creatorAmount;
      await creator.save();
    }

  } catch (error) {
    console.error("Error handling checkout completed:", error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    const { templateId, userId } = paymentIntent.metadata;

    // Update transaction if exists
    const transaction = await Transaction.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (transaction && transaction.status === "pending") {
      transaction.status = "completed";
      transaction.stripeChargeId = paymentIntent.latest_charge;
      await transaction.save();
    }
  } catch (error) {
    console.error("Error handling payment succeeded:", error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    const transaction = await Transaction.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (transaction) {
      transaction.status = "failed";
      await transaction.save();
    }
  } catch (error) {
    console.error("Error handling payment failed:", error);
  }
}

/**
 * Handle refund
 */
async function handleRefund(charge) {
  try {
    const paymentIntentId = charge.payment_intent;
    const transaction = await Transaction.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (transaction) {
      transaction.status = "refunded";
      transaction.refundedAt = new Date();
      transaction.refundAmount = charge.amount_refunded / 100; // Convert from cents
      await transaction.save();

      // Update creator earnings (reverse)
      const creator = await User.findById(transaction.creator);
      if (creator) {
        creator.totalEarnings = Math.max(0, creator.totalEarnings - transaction.creatorAmount);
        creator.pendingPayout = Math.max(0, creator.pendingPayout - transaction.creatorAmount);
        await creator.save();
      }

      // Remove from template purchasedBy
      const template = await ButtonTemplate.findById(transaction.template);
      if (template) {
        template.purchasedBy = template.purchasedBy.filter(
          (id) => id.toString() !== transaction.buyer.toString()
        );
        template.salesCount = Math.max(0, (template.salesCount || 0) - 1);
        await template.save();
      }
    }
  } catch (error) {
    console.error("Error handling refund:", error);
  }
}

/**
 * Verify payment and confirm purchase (for frontend callback)
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    if (!sessionId) {
      return next(new AppError("Session ID is required", 400));
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata.userId !== userId.toString()) {
      return next(new AppError("Unauthorized", 403));
    }

    // Check transaction in database
    const transaction = await Transaction.findOne({
      stripeSessionId: sessionId,
    }).populate("template", "title thumbnailSource");

    if (!transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    res.status(200).json({
      success: true,
      transaction: {
        id: transaction._id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        template: transaction.template,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    next(new AppError(error.message || "Failed to verify payment", 500));
  }
};

/**
 * Submit manual payment proof (for bKash, Nagad, Rocket, Bank Transfer, Payoneer)
 */
export const submitPaymentProof = async (req, res, next) => {
  try {
    const { transactionId, transactionId: paymentTxnId, phoneNumber, bankName, accountNumber, referenceNumber, notes } = req.body;
    const screenshot = req.file?.path || req.body.screenshot; // If using multer for file upload
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    if (!transactionId) {
      return next(new AppError("Transaction ID is required", 400));
    }

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    if (transaction.buyer.toString() !== userId.toString()) {
      return next(new AppError("Unauthorized", 403));
    }

    if (transaction.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Transaction already completed",
        transaction,
      });
    }

    // Update transaction with payment proof
    transaction.manualPaymentDetails = {
      method: transaction.paymentMethod,
      transactionId: paymentTxnId || referenceNumber,
      phoneNumber,
      bankName,
      accountNumber,
      referenceNumber,
      screenshot,
      notes,
    };
    transaction.status = "verifying";
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Payment proof submitted. Your transaction will be verified within 24-48 hours.",
      transaction: {
        id: transaction._id,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
      },
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to submit payment proof", 500));
  }
};

/**
 * Verify manual payment (Admin only)
 */
export const verifyManualPayment = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== "admin" && !req.user?.isSuperAdmin) {
      return next(new AppError("Admin access required", 403));
    }

    const { transactionId } = req.params;
    const { verified, notes } = req.body;

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    if (transaction.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Transaction already completed",
        transaction,
      });
    }

    if (verified === true) {
      // Complete the transaction
      await completeTransaction(transactionId, req.user._id);

      const updatedTransaction = await Transaction.findById(transactionId);
      res.status(200).json({
        success: true,
        message: "Payment verified and transaction completed",
        transaction: updatedTransaction,
      });
    } else {
      // Reject the payment
      transaction.status = "failed";
      if (notes) {
        transaction.manualPaymentDetails = transaction.manualPaymentDetails || {};
        transaction.manualPaymentDetails.rejectionReason = notes;
      }
      await transaction.save();

      res.status(200).json({
        success: true,
        message: "Payment verification rejected",
        transaction,
      });
    }
  } catch (error) {
    next(new AppError(error.message || "Failed to verify payment", 500));
  }
};

/**
 * Get pending manual payments for admin verification
 */
export const getPendingManualPayments = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== "admin" && !req.user?.isSuperAdmin) {
      return next(new AppError("Admin access required", 403));
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find({
      status: "verifying",
      requiresVerification: true,
      paymentMethod: { $in: ["manual", "payoneer", "bkash", "nagad", "rocket", "bank_transfer"] },
    })
      .populate("buyer", "name email")
      .populate("template", "title")
      .populate("creator", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      status: "verifying",
      requiresVerification: true,
      paymentMethod: { $in: ["manual", "payoneer", "bkash", "nagad", "rocket", "bank_transfer"] },
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      transactions,
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to fetch pending payments", 500));
  }
};

/**
 * Get user's purchase history
 */
export const getPurchaseHistory = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const transactions = await Transaction.find({ buyer: userId })
      .populate("template", "title thumbnailSource priceType")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    next(new AppError(error.message || "Failed to fetch purchase history", 500));
  }
};
