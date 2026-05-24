import User from "../models/User.model.js";
import Visitor from "../models/Visitor.js";
import Session from "../models/Session.js";

// @desc    Get daily user stats for last 30 days
// @route   GET /api/stats/daily-users
// @access  Admin / SuperAdmin
export const getDailyUserStats = async (req, res) => {
  try {
    const { range = "30d" } = req.query;
    let startDate = new Date();
    let format = "%Y-%m-%d";

    if (range === "7d") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === "30d") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === "90d") {
      startDate.setDate(startDate.getDate() - 90);
    } else if (range === "hourly") {
      startDate.setHours(startDate.getHours() - 24);
      format = "%Y-%m-%d %H:00";
    } else if (range === "live") {
      startDate.setMinutes(startDate.getMinutes() - 60);
      format = "%Y-%m-%d %H:%M";
    } else if (range === "lifetime") {
      startDate = new Date(2023, 0, 1); // Start of platform
    }

    const [userStats, visitorStats, trafficStats] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: format, date: "$createdAt" } },
              role: "$role",
              hasCraftsmanAccount: "$hasCraftsmanAccount",
              isHost: "$isHost",
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Visitor.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: format, date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      Session.aggregate([
        { $match: { start: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: format, date: "$start" } },
            totalSessions: { $sum: 1 },
            totalPageViews: { $sum: "$pageViews" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Create a map of all dates/times to merge data
    const mergedMap = new Map();

    // 1. Initialize map with dates from all sources to ensure completeness
    const allDates = new Set([
      ...userStats.map(s => s._id.date),
      ...visitorStats.map(s => s._id),
      ...trafficStats.map(s => s._id)
    ]);

    allDates.forEach(date => {
      mergedMap.set(date, { 
        date, 
        craftsmen: 0, patrons: 0, users: 0, 
        visitors: 0, sessions: 0, pageviews: 0 
      });
    });

    // 2. Process user stats
    userStats.forEach((stat) => {
      const { date, role, hasCraftsmanAccount, isHost } = stat._id;
      const entry = mergedMap.get(date);
      if (!entry) return;
      
      if (role === "patron") {
        entry.patrons += stat.count;
      } else if (isHost) {
        entry.craftsmen += stat.count;
      } else if (hasCraftsmanAccount) {
        entry.craftsmen += stat.count;
      } else {
        entry.users += stat.count;
      }
    });

    // 3. Process visitor stats
    visitorStats.forEach((stat) => {
      const date = stat._id;
      const entry = mergedMap.get(date);
      if (entry) entry.visitors += stat.count;
    });

    // 4. Process traffic (sessions/pageviews)
    trafficStats.forEach((stat) => {
      const date = stat._id;
      const entry = mergedMap.get(date);
      if (entry) {
        entry.sessions += stat.totalSessions;
        entry.pageviews += stat.totalPageViews;
      }
    });

    const stats = Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // For AdminAnalytics (world-class dashboard)
    const dates = stats.map((d) => d.date);
    const totalSessions = stats.map((d) => d.sessions);
    const totalPageViews = stats.map((d) => d.pageviews);

    return res.status(200).json({ 
      success: true, 
      stats, 
      range,
      dates,
      totalSessions,
      totalPageViews
    });
  } catch (err) {
    console.error("Daily stats error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error generating daily stats", err: err.message });
  }
};

// @desc    Get user analytics for dashboard
// @route   GET /api/stats/user-analysis
// @access  Admin / SuperAdmin
export const getUsersAnalysis = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    // 🚀 High-Performance Parallel Execution: O(max(queries)) instead of O(sum(queries))
    const [
      totalUsers,
      newUsersCount,
      totalVisitors,
      newVisitorsIn30Days,
      deviceStats,
      browserStats,
      osStats,
      countryStats,
      sourceStats,
      lastLoginStats,
      returningVisitorsCount,
      newVisitorsActual
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      Visitor.countDocuments(),
      Visitor.countDocuments({ createdAt: { $gte: last30 } }),
      Visitor.aggregate([
        { $group: { _id: { $ifNull: ["$device", "Unknown"] }, count: { $sum: 1 } } }
      ]),
      Visitor.aggregate([
        { $group: { _id: { $ifNull: ["$browser", "Unknown"] }, count: { $sum: 1 } } }
      ]),
      Visitor.aggregate([
        { $group: { _id: { $ifNull: ["$os", "Unknown"] }, count: { $sum: 1 } } }
      ]),
      Visitor.aggregate([
        { $group: { _id: { $ifNull: ["$location.country", "Unknown"] }, count: { $sum: 1 } } }
      ]),
      Visitor.aggregate([
        { $group: { _id: { $ifNull: ["$referrer", "Direct"] }, count: { $sum: 1 } } }
      ]),
      User.find(
        {},
        { name: 1, email: 1, lastActiveAt: 1, device: 1, browser: 1, referrer: 1 }
      )
        .sort({ lastActiveAt: -1 })
        .limit(10)
        .lean(),
      Visitor.countDocuments({ sessionCount: { $gt: 0 } }),
      Visitor.countDocuments({ createdAt: { $gte: last30 } })
    ]);

    // Better logic: 
    // Returning visitors are those who have visited more than once
    const actualReturning = await Visitor.countDocuments({ sessionCount: { $gt: 1 } });
    
    const repeatedUsers = totalUsers - newUsersCount;

    // Normalize stats to match frontend expectations
    const browsers = browserStats.map(s => ({ _id: s._id, count: s.count }));
    const devices = deviceStats.map(s => ({ _id: s._id, count: s.count }));
    const countries = countryStats.map(s => ({ _id: s._id, count: s.count }));

    res.status(200).json({
      success: true,
      totalUsers,
      newUsers: newUsersCount,
      repeatedUsers,
      totalVisitors,
      newVisitors: newVisitorsIn30Days,
      returningVisitors: actualReturning,
      devices,
      browsers,
      osStats,
      countries,
      sourceStats,
      lastLoginStats,
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

