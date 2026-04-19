import User from "../models/User.model.js";

// @desc    Get user profile
// @route   GET /api/v1/user/profile
// @access  Private
export const getUserProfile = async (req, res) => {
    try {
      // Populate creatorProfileId to use as fallback for profile picture
      const user = await User.findById(req.user._id)
          .populate("creatorProfileId", "profilePicture");
  
      if (user) {
        // console.log(`[DEBUG] getUserProfile - User Found: ${user.name}`);
        // console.log(`[DEBUG] getUserProfile - User Pic: '${user.profilePicture}', Creator Pic: '${user.creatorProfileId?.profilePicture}'`);

        res.json({
          success: true,
          data: {
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              bio: user.bio,
              // Fallback to Creator Profile picture if User profile picture is missing
              profilePicture: user.profilePicture || user.creatorProfileId?.profilePicture || "",
              coverPicture: user.coverPicture,
              skills: user.skills,
              interests: user.interests,
              workType: user.workType,
              hasCreatorAccount: user.hasCreatorAccount,
              hasCompletedOnboarding: user.hasCompletedOnboarding,
              // Financial & Security fields needed for Settings
              payoutMethod: user.payoutMethod,
              payoneerEmail: user.payoneerEmail,
              bankDetails: user.bankDetails,
              twoFactorEnabled: user.twoFactorEnabled,
              emailVerified: user.emailVerified,
              createdAt: user.createdAt,
          }
        });
      } else {
        res.status(404).json({ success: false, message: "User not found" });
      }
    } catch (error) {
       console.error("Get Profile Error:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  };

// @desc    Update user profile (Onboarding / Settings)
// @route   PATCH /api/v1/user/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      user.profilePicture = req.body.profilePicture || user.profilePicture;
      user.skills = req.body.skills || user.skills;
      user.interests = req.body.interests || user.interests;
      user.workType = req.body.workType || user.workType;
      
      if (req.body.hasCompletedOnboarding !== undefined) {
         user.hasCompletedOnboarding = req.body.hasCompletedOnboarding;
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        data: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            bio: updatedUser.bio,
            profilePicture: updatedUser.profilePicture,
            skills: updatedUser.skills,
            interests: updatedUser.interests,
            workType: updatedUser.workType,
            hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
             // Financial & Security fields needed for Settings
            payoutMethod: updatedUser.payoutMethod,
            payoneerEmail: updatedUser.payoneerEmail,
            bankDetails: updatedUser.bankDetails,
            twoFactorEnabled: updatedUser.twoFactorEnabled,
            emailVerified: updatedUser.emailVerified,
            createdAt: updatedUser.createdAt,
        }
      });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
     console.error("Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
