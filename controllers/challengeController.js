import Challenge from "../models/Challenge.model.js";
import logger from "../utils/logger.js";

/**
 * @desc    Get all challenges
 * @route   GET /api/v1/challenges
 * @access  Public
 */
export const getChallenges = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;

    // Auto-seed if empty for demo purposes (Optional, but good for UX)
    const count = await Challenge.countDocuments();
    if (count === 0) {
        await Challenge.create({
            title: "Redesign the Future Dashboard",
            description: "Create a futuristic, glassmorphism-based dashboard for a SaaS analytics platform. Focus on dark mode and neon accents.",
            status: "active",
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            prize: "$500 Cash + 'Design King' Badge",
            prizeDetails: {
                first: "$500",
                second: "$200",
                third: "$100"
            },
            type: "design",
            rules: ["Must use Figma or React", "Dark mode only", "Submit source link"]
        });
    }

    const challenges = await Challenge.find(query)
      .sort({ status: 1, endDate: 1 }) // Active first, then by deadline
      .skip(skip)
      .limit(limit)
      .populate("submissions.user", "name profilePicture");

    res.status(200).json({
      success: true,
      count: challenges.length,
      data: challenges
    });

  } catch (error) {
    logger.error("Get Challenges Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Submit entry to challenge
 * @route   POST /api/v1/challenges/:id/submit
 * @access  Private
 */
export const submitEntry = async (req, res) => {
    try {
        const { projectLink, description } = req.body;
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        if (challenge.status !== "active") {
            return res.status(400).json({ success: false, message: "Challenge is not active" });
        }

        const alreadySubmitted = challenge.submissions.find(s => s.user.toString() === req.user._id.toString());
        if (alreadySubmitted) {
             return res.status(400).json({ success: false, message: "You have already submitted an entry" });
        }

        challenge.submissions.push({
            user: req.user._id,
            projectLink,
            description
        });

        await challenge.save();

        res.status(200).json({
            success: true,
            message: "Entry submitted successfully"
        });

    } catch (error) {
        logger.error("Submit Challenge Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Create Challenge (Admin)
 * @route   POST /api/v1/challenges
 */
export const createChallenge = async (req, res) => {
    try {
        const challenge = await Challenge.create(req.body);
        res.status(201).json({ success: true, data: challenge });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
