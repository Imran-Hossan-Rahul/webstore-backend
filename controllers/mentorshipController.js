import MentorshipSession from "../models/MentorshipSession.model.js";
import User from "../models/User.model.js";

// @desc    Book a new mentorship session
// @route   POST /api/v1/mentorship/book
// @access  Private
export const bookSession = async (req, res) => {
  try {
    const { mentorId, scheduledDate, topic, notes } = req.body;
    
    if (!mentorId || !scheduledDate || !topic) {
      return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

    // Ensure mentor exists and is a craftsman
    const mentor = await User.findById(mentorId);
    if (!mentor || mentor.role !== "craftsman") {
      return res.status(404).json({ success: false, message: "Mentor not found or invalid role" });
    }

    // Fixed cost for now (e.g. 50 TKNS) or fetch from mentor settings
    const costTokens = mentor.mentorshipRate || 50;

    // Check if mentee has enough tokens
    const mentee = await User.findById(req.user._id);
    if (mentee.walletBalance < costTokens) {
      return res.status(400).json({ success: false, message: "Insufficient TKNS balance" });
    }

    // Escrow tokens (deduct from mentee)
    mentee.walletBalance -= costTokens;
    await mentee.save();

    const session = await MentorshipSession.create({
      mentor: mentorId,
      mentee: req.user._id,
      scheduledDate,
      costTokens,
      topic,
      notes
    });

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error("Book Session Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get user mentorship sessions
// @route   GET /api/v1/mentorship
// @access  Private
export const getMySessions = async (req, res) => {
  try {
    const sessions = await MentorshipSession.find({
      $or: [{ mentor: req.user._id }, { mentee: req.user._id }]
    }).populate("mentor mentee", "name profilePicture username");

    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
