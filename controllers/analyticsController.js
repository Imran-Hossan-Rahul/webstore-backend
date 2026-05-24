// controllers/analyticsController.js
import asyncHandler from "express-async-handler";
import Visitor from "../models/Visitor.js";
import Session from "../models/Session.js";
import Event from "../models/Event.js";
import Artifact from "../models/Artifact.model.js";
import mongoose from "mongoose";

/**
 * ----------------------------
 * Get Daily User Stats (last 30 days)
 * ----------------------------
 */
export const getDailyUserStats = asyncHandler(async (req, res) => {
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 30);

  const dailyStats = await Session.aggregate([
    { $match: { start: { $gte: pastDate, $lte: today } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$start" } },
        totalSessions: { $sum: 1 },
        totalPageViews: { $sum: "$pageViews" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dates = dailyStats.map((d) => d._id);
  const totalSessions = dailyStats.map((d) => d.totalSessions);
  const totalPageViews = dailyStats.map((d) => d.totalPageViews);

  res.status(200).json({ dates, totalSessions, totalPageViews });
});

/**
 * ----------------------------
 * Get Users Analysis
 * ----------------------------
 */
export const getUsersAnalysis = asyncHandler(async (req, res) => {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const totalVisitors = await Visitor.countDocuments();
  const newVisitors = await Visitor.countDocuments({
    firstVisit: { $gte: last30 },
  });
  const returningVisitors = totalVisitors - newVisitors;

  // Device breakdown
  const devices = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$device", "Unknown"] },
        count: { $sum: 1 },
      },
    },
  ]);

  // Browser breakdown
  const browsers = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$browser", "Unknown"] },
        count: { $sum: 1 },
      },
    },
  ]);

  // OS breakdown
  const osStats = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$os", "Unknown"] },
        count: { $sum: 1 },
      },
    },
  ]);

  // Country breakdown
  const countries = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$location.country", "Unknown"] },
        count: { $sum: 1 },
      },
    },
  ]);

  // last logins
  const lastLogins = await Visitor.find({})
    .sort({ lastVisit: -1 })
    .limit(20)
    .select("name email lastVisit device browser referrer");

  res.status(200).json({
    totalVisitors,
    newVisitors,
    returningVisitors,
    devices,
    browsers,
    osStats,
    countries,
    lastLogins,
  });
});

/**
 * ----------------------------
 * Get User Source Stats
 * ----------------------------
 */
export const getUserSourceStats = asyncHandler(async (req, res) => {
  const referrers = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$referrer", "Direct"] },
        count: { $sum: 1 },
      },
    },
  ]);

  const utmCampaigns = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$utm.utm_campaign", "Unknown"] },
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({ referrers, utmCampaigns });
});

/**
 * ----------------------------
 * Get Event Stats
 * ----------------------------
 */
export const getEventStats = asyncHandler(async (req, res) => {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const eventStats = await Event.aggregate([
    { $match: { timestamp: { $gte: last30 } } },
    {
      $group: {
        _id: { $ifNull: ["$eventType", "Unknown"] },
        total: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({ eventStats });
});

/**
 * ----------------------------
 * Get Active Sessions (Real-time)
 * ----------------------------
 */
export const getActiveSessions = asyncHandler(async (req, res) => {
  // last activity within 5 mins = active
  const activityLimit = new Date(Date.now() - 5 * 60 * 1000);

  const activeCount = await Session.countDocuments({
    lastActivity: { $gte: activityLimit },
  });

  res.status(200).json({ activeSessions: activeCount });
});



export const getPageviews = async (req, res) => {
  try {
    const result = await Event.aggregate([
      { $match: { eventType: "pageview" } },
      {
        $group: {
          _id: "$page",
          views: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
    ]);

    res.status(200).json({
      status: "success",
      results: result.length,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const getVisitorAccountStats = async (req, res) => {
  try {
    const data = await Visitor.aggregate([
      {
        $group: {
          _id: {
            hasAccount: {
              $cond: [{ $ifNull: ["$linkedUser", false] }, true, false],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Extract data
    const withAccount =
      data.find((item) => item._id.hasAccount === true)?.count || 0;

    const withoutAccount =
      data.find((item) => item._id.hasAccount === false)?.count || 0;

    const total = withAccount + withoutAccount;

    // Percentage
    const percentWith =
      total > 0 ? ((withAccount / total) * 100).toFixed(2) : 0;
    const percentWithout =
      total > 0 ? ((withoutAccount / total) * 100).toFixed(2) : 0;

    res.status(200).json({
      status: "success",
      data: {
        withAccount,
        withoutAccount,
        total,
        percentWith,
        percentWithout,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const getVisitorDeviceStats = async (req, res) => {
  try {
    const data = await Visitor.aggregate([
      {
        $group: {
          _id: "$device", // device field অনুযায়ী group
          count: { $sum: 1 },
        },
      },
    ]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    // Add percentage to each device
    const result = data.map((item) => ({
      device: item._id,
      count: item.count,
      percent: total > 0 ? ((item.count / total) * 100).toFixed(2) : 0,
    }));

    res.status(200).json({
      status: "success",
      total,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  }
};

// Top 5 countries
export const getTopCountries = async (req, res) => {
  try {
    const data = await Visitor.aggregate([
      {
        $group: {
          _id: "$location.country", // country field
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    const result = data.map((item) => ({
      country: item._id,
      count: item.count,
      percent: total > 0 ? ((item.count / total) * 100).toFixed(2) : 0,
    }));

    res.status(200).json({ status: "success", total, data: result });
  } catch (err) {
    res.status(500).json({ status: "fail", message: err.message });
  }
};

// All countries for dedicated page
export const getAllCountries = async (req, res) => {
  try {
    const data = await Visitor.aggregate([
      {
        $group: {
          _id: "$location.country",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const total = data.reduce((sum, item) => sum + item.count, 0);

    const result = data.map((item) => ({
      country: item._id,
      count: item.count,
      percent: total > 0 ? ((item.count / total) * 100).toFixed(2) : 0,
    }));

    res.status(200).json({ status: "success", total, data: result });
  } catch (err) {
    res.status(500).json({ status: "fail", message: err.message });
  }
};

/**
 * ----------------------------
 * Get Engineer's Views History (Daily)
 * ----------------------------
 */
export const getEngineerViewsHistory = asyncHandler(async (req, res) => {
    const artifacts = await Artifact.find({ user: req.user._id }).select('viewHistory viewsCount title');
    
    if (!artifacts.length) {
        return res.status(200).json({ success: true, data: [] });
    }

    const viewsMap = new Map();
    
    artifacts.forEach(artifact => {
        if (artifact.viewHistory && artifact.viewHistory.length > 0) {
            artifact.viewHistory.forEach(entry => {
                const dateKey = new Date(entry.date).toISOString().split('T')[0];
                const existing = viewsMap.get(dateKey) || 0;
                viewsMap.set(dateKey, existing + (entry.count || 0));
            });
        }
    });
    
    const data = Array.from(viewsMap.entries())
        .map(([date, views]) => ({
            date: new Date(date).toISOString(),
            views
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({ success: true, data });
});

/**
 * ----------------------------
 * Get Engineer's Artifact History (Real Data)
 * ----------------------------
 */
export const getEngineerHistory = asyncHandler(async (req, res) => {
    // 1. Find engineer's artifacts
    const artifacts = await Artifact.find({ user: req.user._id }).select('slug');
    
    if (!artifacts.length) {
        return res.status(200).json({ success: true, data: [] });
    }

    const slugs = artifacts.map(t => t.slug);
    
    // 2. Define date range (e.g., last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 3. Aggregate Events
    const stats = await Event.aggregate([
        {
            $match: {
                eventType: "pageview",
                timestamp: { $gte: sixMonthsAgo },
                // Match pages that contain any of the user's artifact slugs
                // Note: This regex assumes slug is unique enough to not match unwanted paths
                page: { $in: slugs.map(slug => new RegExp(`/${slug}`, 'i')) } 
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }, // Group by Month-Year for long history
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    
    // 4. Format for Frontend
    // Convert "2024-01" to "Jan" format if needed, or send raw dates
    // The frontend currently expects { date: 'Jan', views: 10 }
    
    const formattedData = stats.map(item => {
        const [year, month] = item._id.split('-');
        const dateObj = new Date(year, month - 1);
        const monthName = dateObj.toLocaleString('default', { month: 'short' });
        return {
            date: monthName,
            views: item.count,
            // optional: include year if needed for sorting logic on frontend
            fullDate: item._id 
        };
    });

    res.status(200).json({ success: true, data: formattedData });
});


