import Review from "../models/Review.model.js";
import Contract from "../models/Contract.model.js";
import CraftsmanProfile from "../models/CraftsmanProfile.model.js";
import User from "../models/User.model.js";
import logger from "../utils/logger.js";

/**
 * @desc    Create a review for a contract participant
 * @route   POST /api/v1/reviews
 * @access  Private
 */
export const createReview = async (req, res) => {
  try {
    const { contractId, revieweeId, rating, comment } = req.body;

    // 1. Validate contract existence and completion
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // 2. Security Check: Only participants can review
    const isPatron = contract.patron.toString() === req.user._id.toString();
    const isCraftsman = contract.craftsman.toString() === req.user._id.toString();

    if (!isPatron && !isCraftsman) {
      return res.status(403).json({ success: false, message: "You are not a participant in this contract" });
    }

    // 3. Status Check: Only completed or cancelled contracts can be reviewed (mostly completed)
    if (!["completed", "cancelled"].includes(contract.status)) {
      // If it's active but all milestones are paid, we might consider it reviewable
      const allMilestonesPaid = contract.milestones.every(m => m.status === "paid");
      if (!allMilestonesPaid) {
        return res.status(400).json({ success: false, message: "Contract must be completed before reviewing" });
      }
    }

    // 4. Ensure reviewee is actually the other party
    const expectedReviewee = isPatron ? contract.craftsman.toString() : contract.patron.toString();
    if (revieweeId !== expectedReviewee) {
      return res.status(400).json({ success: false, message: "Invalid reviewee for this contract" });
    }

    // 5. Create Review
    const review = await Review.create({
      contract: contractId,
      reviewer: req.user._id,
      reviewee: revieweeId,
      rating,
      comment,
      role: isPatron ? "patron" : "craftsman" // Role of the reviewer
    });

    // 6. Update Reviewee's aggregate rating (if they are a craftsman)
    const profile = await CraftsmanProfile.findOne({ userId: revieweeId });
    if (profile) {
      const allReviews = await Review.find({ reviewee: revieweeId });
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / allReviews.length;

      profile.rating = {
        average: Number(avgRating.toFixed(2)),
        count: allReviews.length
      };
      await profile.save();
    }

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already reviewed this contract" });
    }
    logger.error("Create Review Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to submit review" });
  }
};

/**
 * @desc    Get reviews for a user
 * @route   GET /api/v1/reviews/user/:userId
 * @access  Public
 */
export const getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate("reviewer", "name profilePicture")
      .populate("contract", "title")
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};
