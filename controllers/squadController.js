import Squad from "../models/Squad.model.js";
import User from "../models/User.model.js";

// @desc    Create a new squad
// @route   POST /api/v1/squads
// @access  Private
export const createSquad = async (req, res) => {
  try {
    const { name, description, skills } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Squad name is required" });
    }

    const existingSquad = await Squad.findOne({ name });
    if (existingSquad) {
      return res.status(400).json({ success: false, message: "Squad name already exists" });
    }

    const squad = await Squad.create({
      name,
      description,
      skills: skills || [],
      leader: req.user._id,
      members: [{ user: req.user._id, role: "admin" }]
    });

    res.status(201).json({ success: true, data: squad });
  } catch (error) {
    console.error("Create Squad Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get all squads
// @route   GET /api/v1/squads
// @access  Public
export const getSquads = async (req, res) => {
  try {
    const squads = await Squad.find({ isActive: true })
      .populate("leader", "name profilePicture username isVerified")
      .populate("members.user", "name profilePicture username")
      .sort({ totalXP: -1 });

    res.status(200).json({ success: true, data: squads });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Join a squad
// @route   POST /api/v1/squads/:id/join
// @access  Private
export const joinSquad = async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.id);
    if (!squad) return res.status(404).json({ success: false, message: "Squad not found" });

    // Check if already a member
    if (squad.members.some(m => m.user.toString() === req.user._id.toString())) {
      return res.status(400).json({ success: false, message: "Already a member" });
    }

    squad.members.push({ user: req.user._id, role: "member" });
    await squad.save();

    res.status(200).json({ success: true, data: squad });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
