import User from "../models/User.model.js";
// @desc    Get daily user stats for last 30 days
// @route   GET /api/stats/daily-users
// @access  Admin / SuperAdmin
export const getDailyUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
          },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            accountType: "$accountType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          freelancers: {
            $sum: {
              $cond: [{ $eq: ["$_id.accountType", "freelancer"] }, "$count", 0],
            },
          },
          clients: {
            $sum: {
              $cond: [{ $eq: ["$_id.accountType", "client"] }, "$count", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          freelancers: 1,
          clients: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    return res.status(200).json({ success: true, stats });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Error generating daily stats", err });
  }
};

// @desc    Get user analytics for dashboard
// @route   GET /api/stats/user-analysis
// @access  Admin / SuperAdmin
export const getUsersAnalysis = async (req, res) => {
  try {
    // 1️⃣ Total users
    const totalUsers = await User.countDocuments();

    // 2️⃣ New vs repeated users (today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: todayStart },
    });
    const repeatedUsers = totalUsers - newUsers;

    // 3️⃣ Device distribution
    const deviceStats = await User.aggregate([
      {
        $group: {
          _id: "$device",
          count: { $sum: 1 },
        },
      },
    ]);

    // 4️⃣ Browser distribution
    const browserStats = await User.aggregate([
      {
        $group: {
          _id: "$browser",
          count: { $sum: 1 },
        },
      },
    ]);

    // 5️⃣ Account type distribution (freelancer/client)
    const accountTypeStats = await User.aggregate([
      {
        $group: {
          _id: "$accountType",
          count: { $sum: 1 },
        },
      },
    ]);

    // 6️⃣ Referrer / source distribution
    const sourceStats = await User.aggregate([
      {
        $group: {
          _id: "$referrer",
          count: { $sum: 1 },
        },
      },
    ]);

    // 7️⃣ Last 10 logins summary
    const lastLoginStats = await User.find(
      {},
      { name: 1, email: 1, lastLogin: 1, device: 1, browser: 1, referrer: 1 }
    )
      .sort({ lastLogin: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        newUsers,
        repeatedUsers,
        deviceStats,
        browserStats,
        accountTypeStats,
        sourceStats,
        lastLoginStats,
      },
    });
  } catch (error) {
    console.error("Error in getUsersAnalysis:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user analysis",
    });
  }
};

// @desc    Get user referrer stats for dashboard (optional endpoint)
// @route   GET /api/stats/user-source
// @access  Admin / SuperAdmin
export const getUserSourceStats = async (req, res) => {
  try {
    const sourceStats = await User.aggregate([
      {
        $group: {
          _id: "$referrer",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({ success: true, data: sourceStats });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching source stats", err });
  }
};
