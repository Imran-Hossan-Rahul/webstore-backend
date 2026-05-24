import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import User from "../models/User.model.js";
import Session from "../models/Session.js";
import VerificationRequest from "../models/VerificationRequest.model.js";
import Visitor from "../models/Visitor.js";
import Job from "../models/Job.model.js";
import Post from "../models/Post.model.js";
import Transaction from "../models/Transaction.model.js";
import Contract from "../models/Contract.model.js";
import SocialActivity from "../models/SocialActivity.model.js";
import Comment from "../models/Comment.model.js";
import Artifact from "../models/Artifact.model.js";
import Event from "../models/Event.js";
import UserBehaviorEvent from "../models/UserBehaviorEvent.model.js";
// Graceful optional imports (may not exist in all environments)
let Codex, Challenge, Chat;
try { Codex = (await import("../models/Codex.model.js")).default; } catch { Codex = null; }
try { Challenge = (await import("../models/Challenge.model.js")).default; } catch { Challenge = null; }
try { Chat = (await import("../models/Chat.model.js")).default; } catch { Chat = null; }

/**
 * @desc    Get Comprehensive Dashboard Overview
 * @route   GET /api/v1/stats/overview
 * @access  Admin / SuperAdmin
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
  // 1. Run all basic counts in parallel (O(max(queries)) instead of O(sum(queries)))
  const [
    totalUsers,
    totalVisitors,
    pendingVerifications,
    activeSessions
  ] = await Promise.all([
    User.countDocuments(),
    Visitor.countDocuments(),
    VerificationRequest.countDocuments({ status: "pending" }),
    Session.countDocuments({
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    })
  ]);
  
  // 2. Growth Calculation (Current Month vs Last Month) - Also parallelized
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const [currentMonthUsers, lastMonthUsers] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: startOfCurrentMonth } }),
    User.countDocuments({ 
      createdAt: { $gte: startOfLastMonth, $lt: startOfCurrentMonth } 
    })
  ]);

  let growth = 0;
  if (lastMonthUsers > 0) {
    growth = ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;
  } else if (currentMonthUsers > 0) {
    growth = 100; // First month growth
  }

  // 5. Account vs Guest Distribution
  const guestCount = Math.max(0, totalVisitors - totalUsers);
  const accountDistribution = [
    { name: "Registered", value: totalUsers },
    { name: "Guests", value: guestCount }
  ];

  // 6. User Status Breakdown
  const userStatus = await User.aggregate([
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$isVerified", true] }, "Authorized", "Unverified"
          ]
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // 7. Top Countries
  const countries = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$location.country", "Unknown"] },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // 8. Device/Browser Stats
  const browsers = await Visitor.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$browser", "Other"] },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 4 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalVisitors,
        pendingVerifications,
        activeSessions,
        growth: growth.toFixed(1)
      },
      accountDistribution,
      userStatus: userStatus.map(t => ({ name: t._id, value: t.count })),
      countries: countries.map(c => ({ name: c._id, value: c.count })),
      browsers: browsers.map(b => ({ name: b._id, value: b.count })),
    }
  });
});

/**
 * @desc    Get All Users (Paginated & Searchable)
 * @route   GET /api/v1/stats/users
 * @access  Admin / SuperAdmin
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const role = req.query.role || "";

    const query = {};
    if (search) {
        // Use high-performance text search instead of O(n) regex
        query.$text = { $search: search };
    }
    if (role) {
        query.role = role;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
        .select("-password")
        .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(); // Faster lookup

    res.status(200).json({
        success: true,
        data: users,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit)
        }
    });
});

/**
 * @desc    Get complete forensic dossier of a user
 * @route   GET /api/v1/admin/user/:id/dossier
 * @access  Admin / SuperAdmin
 */
export const getUserFullDossier = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Basic User & Security Context
    // Selecting all fields needed for forensic audit including sensitive ones if hidden
    const user = await User.findById(id).select("+isSuperAdmin +isEmailVerified +lastLoginIp +device +browser");
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Comprehensive Data Aggregation (Limited to prevent memory issues)
    const [
        verifications,
        transactions,
        jobs,
        contracts,
        activities,
        posts,
        comments
    ] = await Promise.all([
        VerificationRequest.find({ user: id }).sort({ createdAt: -1 }).limit(20),
        Transaction.find({ $or: [{ fromUser: id }, { toUser: id }] })
            .sort({ createdAt: -1 })
            .populate("fromUser toUser", "name email")
            .limit(20),
        Job.find({ patron: id }).sort({ createdAt: -1 }).limit(20),
        Contract.find({ $or: [{ patron: id }, { craftsman: id }] })
            .sort({ createdAt: -1 })
            .populate("patron craftsman", "name profilePicture")
            .limit(20),
        Activity.find({ user: id }).sort({ timestamp: -1 }).limit(50),
        Post.find({ author: id }).sort({ createdAt: -1 }).limit(20),
        Comment.find({ user: id }).sort({ createdAt: -1 }).limit(50)
    ]);

    // 3. Financial Intelligence (Optimized with Aggregation)
    const objId = new mongoose.Types.ObjectId(id);
    const financialStats = await Transaction.aggregate([
        { 
            $match: { 
                $or: [{ fromUser: objId }, { toUser: objId }],
                status: 'completed'
            } 
        },
        {
            $group: {
                _id: null,
                totalSpent: {
                    $sum: { $cond: [{ $eq: ["$fromUser", objId] }, "$amount", 0] }
                },
                totalEarned: {
                    $sum: { $cond: [{ $eq: ["$toUser", objId] }, "$amount", 0] }
                }
            }
        }
    ]);

    const { totalSpent = 0, totalEarned = 0 } = financialStats[0] || {};

    // 4. Unified Behavioral Timeline (The 60x Experience)
    let timeline = [];

    // Jobs
    jobs.forEach(job => timeline.push({
        title: "Job Deployed",
        description: `Posted: ${job.title} with budget ${job.budget?.min || 0}-${job.budget?.max || 0}`,
        timestamp: job.createdAt,
        type: "job",
        severity: "major",
        icon: "Briefcase"
    }));

    // Contracts
    contracts.forEach(c => timeline.push({
        title: "Contract Active",
        description: `Devlog: ${c.title} is currently ${c.status}`,
        timestamp: c.updatedAt,
        type: "contract",
        severity: "major",
        icon: "FileSignature"
    }));

    // Transactions
    transactions.forEach(t => timeline.push({
        title: t.fromUser?._id?.toString() === id ? "Capital Outflow" : "Capital Inflow",
        description: `${t.amount} ${t.currency} via ${t.paymentMethod} (${t.status})`,
        timestamp: t.createdAt,
        type: "transaction",
        severity: "major",
        icon: "CreditCard"
    }));

    // Verifications
    verifications.forEach(v => timeline.push({
        title: "Identity Audit",
        description: `Verification status updated to ${v.status}`,
        timestamp: v.createdAt,
        type: "verification",
        severity: "major",
        icon: "ShieldCheck"
    }));

    // Activities (Minor Signals)
    activities.forEach(act => timeline.push({
        title: act.activityType?.split('_').join(' ').toUpperCase() || "ACTIVITY_SIGNAL",
        description: act.details || "System interaction recorded",
        timestamp: act.timestamp || act.createdAt,
        type: "activity",
        severity: "minor",
        icon: "Activity"
    }));

    // Posts & Comments
    posts.forEach(p => timeline.push({
        title: "Social Signal",
        description: `Shared post: ${p.title?.slice(0, 50)}...`,
        timestamp: p.createdAt,
        type: "post",
        severity: "minor",
        icon: "Layout"
    }));

    // Sort and Slice
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
        success: true,
        data: {
            profile: user,
            stats: {
                totalSpent,
                totalEarned,
                transactionCount: transactions.length,
                jobCount: jobs.length,
                contractCount: contracts.length,
                verificationCount: verifications.length,
                socialCount: posts.length + comments.length
            },
            financials: transactions,
            work: { jobs, contracts },
            security: {
                lastLogin: user.lastLogin,
                lastLoginIp: user.lastLoginIp,
                deviceHistory: [user.device].filter(Boolean),
                browser: user.browser
            },
            verifications,
            timeline: timeline.slice(0, 100)
        }
    });
});

/**
 * @desc    Get Platform Health Status (Real-time)
 * @route   GET /api/v1/stats/platform-health
 * @access  Admin / SuperAdmin
 */
export const getPlatformHealth = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalSessions,
    activeSessions,
    totalVisitors,
    totalEvents,
  ] = await Promise.all([
    User.countDocuments(),
    Session.countDocuments(),
    Session.countDocuments({ lastActivity: { $gte: new Date(Date.now() - 5 * 60 * 1000) } }),
    Visitor.countDocuments(),
    Event.countDocuments(),
  ]);

  const memUsage = process.memoryUsage();
  const onlineUsers = global.__onlineUsers ? global.__onlineUsers.size : 0;

  res.status(200).json({
    success: true,
    data: {
      server: {
        uptime: Math.round(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
          externalMB: Math.round(memUsage.external / 1024 / 1024),
          usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        cpu: process.cpuUsage(),
      },
      database: {
        status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        readyState: mongoose.connection.readyState,
        collections: Object.keys(mongoose.connection.collections || {}).length,
        stats: {
          totalUsers,
          totalSessions,
          totalVisitors,
          totalEvents,
        },
      },
      realtime: {
        onlineUsers,
        activeSessions,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/**
 * @desc    Get Conversion Funnel
 * @route   GET /api/v1/stats/funnel
 * @access  Admin / SuperAdmin
 */
export const getConversionFunnel = asyncHandler(async (req, res) => {
  const [
    totalVisitors,
    registeredUsers,
    profileCompleted,
    firstPost,
    firstPurchase,
    verifiedUsers,
  ] = await Promise.all([
    Visitor.countDocuments(),
    User.countDocuments(),
    User.countDocuments({ bio: { $ne: "" }, profilePicture: { $ne: "" } }),
    Post.distinct("author").then(authors => authors.length),
    Transaction.distinct("sender", { status: "completed" }).then(senders => senders.length),
    User.countDocuments({ isVerified: true }),
  ]);

  const steps = [
    { label: "Total Visitors", count: totalVisitors, percent: 100 },
    { label: "Registered", count: registeredUsers, percent: totalVisitors > 0 ? ((registeredUsers / totalVisitors) * 100).toFixed(1) : 0 },
    { label: "Profile Completed", count: profileCompleted, percent: registeredUsers > 0 ? ((profileCompleted / registeredUsers) * 100).toFixed(1) : 0 },
    { label: "Created Content", count: firstPost, percent: registeredUsers > 0 ? ((firstPost / registeredUsers) * 100).toFixed(1) : 0 },
    { label: "Made Transaction", count: firstPurchase, percent: registeredUsers > 0 ? ((firstPurchase / registeredUsers) * 100).toFixed(1) : 0 },
    { label: "Got Verified", count: verifiedUsers, percent: registeredUsers > 0 ? ((verifiedUsers / registeredUsers) * 100).toFixed(1) : 0 },
  ];

  res.status(200).json({ success: true, data: steps });
});

/**
 * @desc    Get User Retention Cohort (Weekly)
 * @route   GET /api/v1/stats/retention
 * @access  Admin / SuperAdmin
 */
export const getRetentionCohort = asyncHandler(async (req, res) => {
  const now = new Date();
  const cohorts = [];

  // Last 8 weeks
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);

    const cohortUsers = await User.find({
      createdAt: { $gte: weekStart, $lt: weekEnd },
    }).select("_id lastActiveAt lastLogin");

    const total = cohortUsers.length;
    if (total === 0) {
      cohorts.push({
        week: `W-${w}`,
        total: 0,
        retained: { w1: 0, w2: 0, w4: 0, w8: 0 },
      });
      continue;
    }

    const retainedW1 = cohortUsers.filter(u => {
      const last = u.lastActiveAt || u.lastLogin;
      return last && (new Date(last) - new Date(u.createdAt)) > 7 * 24 * 60 * 60 * 1000;
    }).length;

    cohorts.push({
      week: `W-${w === 0 ? "current" : w}`,
      weekStart: weekStart.toISOString().split("T")[0],
      total,
      retained: {
        w1: total > 0 ? Math.round((retainedW1 / total) * 100) : 0,
      },
    });
  }

  res.status(200).json({ success: true, data: cohorts });
});

/**
 * @desc    Get Feature Usage Stats (DAU/WAU/MAU per feature)
 * @route   GET /api/v1/stats/feature-usage
 * @access  Admin / SuperAdmin
 */
export const getFeatureUsage = asyncHandler(async (req, res) => {
  const now = new Date();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    // Chat
    chatDAU, chatWAU, chatMAU,
    // Jobs
    jobsDAU, jobsMAU,
    // Artifacts
    artifactsDAU, artifactsMAU,
    // Challenges
    challengesDAU, challengesMAU,
    // Codex
    codexMAU,
    // Contracts
    contractsMAU,
  ] = await Promise.all([
    Chat.countDocuments({ updatedAt: { $gte: dayAgo } }).catch(() => 0),
    Chat.countDocuments({ updatedAt: { $gte: weekAgo } }).catch(() => 0),
    Chat.countDocuments({ updatedAt: { $gte: monthAgo } }).catch(() => 0),
    Job.countDocuments({ createdAt: { $gte: dayAgo } }).catch(() => 0),
    Job.countDocuments({ createdAt: { $gte: monthAgo } }).catch(() => 0),
    Artifact.countDocuments({ updatedAt: { $gte: dayAgo } }).catch(() => 0),
    Artifact.countDocuments({ updatedAt: { $gte: monthAgo } }).catch(() => 0),
    Challenge.countDocuments({ createdAt: { $gte: dayAgo } }).catch(() => 0),
    Challenge.countDocuments({ createdAt: { $gte: monthAgo } }).catch(() => 0),
    Codex.countDocuments({ createdAt: { $gte: monthAgo } }).catch(() => 0),
    Contract.countDocuments({ createdAt: { $gte: monthAgo } }).catch(() => 0),
  ]);

  const features = [
    { name: "Chat", icon: "MessageCircle", dau: chatDAU, wau: chatWAU, mau: chatMAU },
    { name: "Jobs", icon: "Briefcase", dau: jobsDAU, wau: null, mau: jobsMAU },
    { name: "Artifacts", icon: "Layout", dau: artifactsDAU, wau: null, mau: artifactsMAU },
    { name: "Challenges", icon: "Trophy", dau: challengesDAU, wau: null, mau: challengesMAU },
    { name: "Codex", icon: "FileText", dau: null, wau: null, mau: codexMAU },
    { name: "Contracts", icon: "FileSignature", dau: null, wau: null, mau: contractsMAU },
  ];

  res.status(200).json({ success: true, data: features });
});

/**
 * @desc    Get Hourly Traffic Pattern (last 7 days)
 * @route   GET /api/v1/stats/hourly-traffic
 * @access  Admin / SuperAdmin
 */
export const getHourlyTraffic = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const hourlyData = await Session.aggregate([
    { $match: { startedAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $hour: "$startedAt" },
        count: { $sum: 1 },
        avgDuration: { $avg: "$duration" },
        avgEngagement: { $avg: "$engagementScore" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill all 24 hours (0-23)
  const result = Array.from({ length: 24 }, (_, hour) => {
    const found = hourlyData.find(d => d._id === hour);
    return {
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      count: found?.count || 0,
      avgDurationMs: Math.round(found?.avgDuration || 0),
      avgEngagement: Math.round(found?.avgEngagement || 0),
    };
  });

  res.status(200).json({ success: true, data: result });
});

/**
 * @desc    Get User Full Dossier â€” UPGRADED with deep intelligence
 * @route   GET /api/v1/stats/user/:id/dossier
 * @access  Admin / SuperAdmin
 */
export const getUserFullDossierV2 = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select("+isSuperAdmin +emailVerified +lastLogin +lastActiveAt +loginAttempts +lockUntil +auditLogs +sessions +device +browser");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const objId = new mongoose.Types.ObjectId(id);

  // Fetch all data in parallel
  const [
    verifications,
    transactions,
    jobs,
    contracts,
    activities,
    posts,
    comments,
    codex,
    visitorRecord,
    sessions,
    behaviors
  ] = await Promise.all([
    VerificationRequest.find({ user: id }).sort({ createdAt: -1 }).limit(20),
    Transaction.find({ $or: [{ fromUser: objId }, { toUser: objId }] })
      .sort({ createdAt: -1 }).populate("fromUser toUser", "name email").limit(30),
    Job.find({ patron: id }).sort({ createdAt: -1 }).limit(20),
    Contract.find({ $or: [{ patron: objId }, { craftsman: objId }] })
      .sort({ createdAt: -1 }).populate("patron craftsman", "name profilePicture").limit(20),
    Activity.find({ user: objId }).sort({ createdAt: -1 }).limit(100),
    Post.find({ author: id }).sort({ createdAt: -1 }).limit(20),
    Comment.find({ user: id }).sort({ createdAt: -1 }).limit(50),
    Codex.find({ author: id }).sort({ createdAt: -1 }).limit(20).catch(() => []),
    Visitor.findOne({ linkedUser: objId }).lean(),
    Session.find({ linkedUser: objId }).sort({ startedAt: -1 }).limit(20).lean(),
    UserBehaviorEvent.find({ userId: objId }).sort({ timestamp: -1 }).limit(100).lean(),
  ]);

  // Financial Intelligence
  const financialStats = await Transaction.aggregate([
    { $match: { $or: [{ fromUser: objId }, { toUser: objId }], status: "completed" } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: { $cond: [{ $eq: ["$fromUser", objId] }, "$amount", 0] } },
        totalEarned: { $sum: { $cond: [{ $eq: ["$toUser", objId] }, "$amount", 0] } },
        txCount: { $sum: 1 },
        avgTxAmount: { $avg: "$amount" },
        maxTxAmount: { $max: "$amount" },
      },
    },
  ]);
  const { totalSpent = 0, totalEarned = 0, txCount = 0, avgTxAmount = 0, maxTxAmount = 0 } = financialStats[0] || {};

  // Hourly Activity Heatmap (based on activities + sessions)
  const hourCounts = Array(24).fill(0);
  const dayCounts = Array(7).fill(0); // 0=Sun, 6=Sat
  activities.forEach(act => {
    const d = new Date(act.timestamp || act.createdAt);
    if (!isNaN(d.getTime())) {
      hourCounts[d.getHours()]++;
      dayCounts[d.getDay()]++;
    }
  });
  sessions.forEach(s => {
    const d = new Date(s.startedAt || s.createdAt);
    if (!isNaN(d.getTime())) {
      hourCounts[d.getHours()]++;
      dayCounts[d.getDay()]++;
    }
  });
  behaviors.forEach(b => {
    const d = new Date(b.timestamp || b.createdAt);
    if (!isNaN(d.getTime())) {
      hourCounts[d.getHours()]++;
      dayCounts[d.getDay()]++;
    }
  });

  // Risk Score (0-100, higher = more risky)
  let riskScore = 0;
  if (user.loginAttempts >= 3) riskScore += 20;
  if (user.lockUntil && new Date(user.lockUntil) > new Date()) riskScore += 30;
  if (!user.emailVerified) riskScore += 15;
  const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
  if (accountAgeDays < 7) riskScore += 10;
  if (user.auditLogs?.filter(l => l.action === "Failed login").length > 3) riskScore += 25;
  
  // Add risk from behavioral events
  if (behaviors && behaviors.some(b => b.eventType === 'print_screen')) riskScore += 15;
  if (behaviors && behaviors.filter(b => b.eventType === 'js_error').length > 5) riskScore += 10;
  
  riskScore = Math.min(riskScore, 100);

  // Engagement Tier
  const lastActive = user.lastActiveAt || user.lastLogin;
  const daysSinceActive = lastActive ? Math.floor((Date.now() - new Date(lastActive)) / (1000 * 60 * 60 * 24)) : 999;
  let engagementTier = "Dormant";
  if (daysSinceActive <= 1) engagementTier = "Power User";
  else if (daysSinceActive <= 7) engagementTier = "Regular";
  else if (daysSinceActive <= 30) engagementTier = "At Risk";

  // Behavior Summary
  const avgSessionDuration = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)
    : 0;
  const avgEngagementScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / sessions.length)
    : 0;
  const bounceRate = sessions.length > 0
    ? Math.round((sessions.filter(s => s.bounced).length / sessions.length) * 100)
    : 0;

  // Feature usage map
  const featureUsage = {
    chat: activities.filter(a => a.activityType?.includes("chat")).length,
    jobs: jobs.length,
    contracts: contracts.length,
    posts: posts.length,
    codex: codex.length,
    comments: comments.length,
    artifacts: 0, // can add artifact count
    challenges: activities.filter(a => a.activityType?.includes("challenge")).length,
  };

  // Unified Behavioral Timeline
  let timeline = [];
  jobs.forEach(j => timeline.push({ title: "Job Deployed", description: `${j.title} Â· Budget: ${j.budget?.min || 0}-${j.budget?.max || 0} TKNS`, timestamp: j.createdAt, type: "job", severity: "major", icon: "Briefcase" }));
  contracts.forEach(c => timeline.push({ title: "Contract Active", description: `${c.title} â€” ${c.status}`, timestamp: c.updatedAt, type: "contract", severity: "major", icon: "FileSignature" }));
  transactions.forEach(t => timeline.push({ title: t.fromUser?._id?.toString() === id ? "Token Spent" : "Token Earned", description: `${t.amount} ${t.currency} via ${t.paymentMethod} (${t.status})`, timestamp: t.createdAt, type: "transaction", severity: "major", icon: "CreditCard" }));
  verifications.forEach(v => timeline.push({ title: "Verification Event", description: `Status â†’ ${v.status}`, timestamp: v.createdAt, type: "verification", severity: "major", icon: "ShieldCheck" }));
  activities.forEach(act => timeline.push({ title: act.activityType?.split("_").join(" ").toUpperCase() || "ACTIVITY", description: act.details || "System signal recorded", timestamp: act.timestamp || act.createdAt, type: "activity", severity: "minor", icon: "Activity" }));
  posts.forEach(p => timeline.push({ title: "Post Published", description: p.title?.slice(0, 60) || "Untitled", timestamp: p.createdAt, type: "post", severity: "minor", icon: "Layout" }));
  codex.forEach(b => timeline.push({ title: "Codex Written", description: b.title?.slice(0, 60) || "Untitled", timestamp: b.createdAt, type: "codex", severity: "minor", icon: "FileText" }));

  // High-Fidelity Behavioral Events
  behaviors.forEach(b => {
    let title = "Behavioral Signal";
    let icon = "Activity";
    let severity = "minor";
    let desc = b.metadata?.description || `Event: ${b.eventType} recorded on ${b.page}`;

    switch (b.eventType) {
      case 'print_screen':
        title = "SCREEN CAPTURE DETECTED";
        icon = "ShieldAlert";
        severity = "major";
        desc = `User attempted a PrintScreen on ${b.page}. Security violation logged.`;
        break;
      case 'download_start':
        title = "File Download Intent";
        icon = "Download";
        severity = "major";
        desc = `Download initiated: ${b.metadata?.fileName || 'Unknown file'} (${b.metadata?.fileType || 'N/A'})`;
        break;
      case 'js_error':
      case 'unhandled_rejection':
        title = "RUNTIME EXCEPTION";
        icon = "AlertTriangle";
        severity = "major";
        desc = `Error caught: ${b.errorMessage?.slice(0, 100)}... on ${b.page}`;
        break;
      case 'rage_click':
        title = "Frustration Signal (Rage Click)";
        icon = "Zap";
        severity = "minor";
        desc = `Detected repetitive clicks on element: ${b.element || 'Unknown'}`;
        break;
      case 'copy':
      case 'paste':
        title = `Clipboard ${b.eventType.toUpperCase()}`;
        icon = "Fingerprint";
        severity = "minor";
        desc = `Content interaction on ${b.page}`;
        break;
    }

    timeline.push({ title, description: desc, timestamp: b.timestamp, type: b.eventType, severity, icon });
  });

  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.status(200).json({
    success: true,
    data: {
      profile: user,
      deviceFingerprint: {
        screenResolution: visitorRecord?.screenResolution,
        language: visitorRecord?.language,
        timezone: visitorRecord?.timezone,
        timezoneOffset: visitorRecord?.timezoneOffset,
        platform: visitorRecord?.platform,
        connectionType: visitorRecord?.connectionType,
        touchSupport: visitorRecord?.touchSupport,
        browser: user.browser || visitorRecord?.browser,
        os: visitorRecord?.os,
        device: user.device || visitorRecord?.device,
        ip: user.ip || visitorRecord?.ip,
        hardwareConcurrency: visitorRecord?.hardwareConcurrency,
      },
      stats: {
        totalSpent, totalEarned, txCount, avgTxAmount: Math.round(avgTxAmount), maxTxAmount,
        jobCount: jobs.length,
        contractCount: contracts.length,
        verificationCount: verifications.length,
        postCount: posts.length,
        codexCount: codex.length,
        commentCount: comments.length,
        sessionCount: sessions.length,
        accountAgeDays,
        riskScore,
        engagementTier,
        avgSessionDurationMs: avgSessionDuration,
        avgEngagementScore,
        bounceRate,
      },
      behaviorSummary: {
        totalSessions: sessions.length,
        avgSessionDurationMs: avgSessionDuration,
        avgEngagementScore,
        bounceRate,
        totalPageViews: visitorRecord?.totalPageViews || 0,
        maxScrollDepth: visitorRecord?.maxScrollDepth || 0,
        totalTimeSpentMs: visitorRecord?.totalTimeSpentMs || 0,
        rageClickCount: visitorRecord?.rageClickCount || 0,
        exitIntentCount: visitorRecord?.exitIntentCount || 0,
        daysSinceActive,
      },
      activityHeatmap: {
        byHour: hourCounts,   // [0..23] = count per hour
        byDay: dayCounts,     // [0..6] = count per weekday
      },
      featureUsage,
      security: {
        lastLogin: user.lastLogin,
        lastActiveAt: user.lastActiveAt,
        lastLoginIp: user.ip,
        loginAttempts: user.loginAttempts || 0,
        isLocked: !!(user.lockUntil && new Date(user.lockUntil) > new Date()),
        lockUntil: user.lockUntil,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        auditLogs: user.auditLogs?.slice(-20) || [],
        deviceHistory: [user.device, visitorRecord?.device].filter(Boolean),
        browserHistory: [user.browser, visitorRecord?.browser].filter(Boolean),
        riskScore,
        riskBreakdown: {
          loginFailures: user.loginAttempts >= 3 ? "âš ï¸ High" : "âœ“ Normal",
          accountLocked: (user.lockUntil && new Date(user.lockUntil) > new Date()) ? "ðŸ”´ Locked" : "âœ“ Open",
          emailVerified: user.emailVerified ? "âœ“ Verified" : "âš ï¸ Unverified",
          accountAge: accountAgeDays < 7 ? "âš ï¸ New Account" : "âœ“ Established",
        },
      },
      financials: transactions,
      work: { jobs, contracts },
      verifications,
      sessions: sessions.slice(0, 10),
      timeline: timeline.slice(0, 150),
    },
  });
});

/**
 * @desc    Get Latest User Behavior Events (Real-time feed)
 * @route   GET /api/v1/stats/live-events
 * @access  Admin / SuperAdmin
 */
export const getLiveEventStream = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 1000;
  const { visitorId } = req.query;
  
  const query = {};
  if (visitorId) query.visitorId = visitorId;

  const events = await UserBehaviorEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name')
    .lean();

  const formattedEvents = events.map(event => ({
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    userId: event.userId?._id || event.userId || null,
    userName: event.userName || event.userId?.name || null,
    eventType: event.eventType,
    page: event.page,
    element: event.element,
    featureName: event.featureName,
    timestamp: event.timestamp,
    country: event.country,
    ip: event.ip
  }));

  res.status(200).json({
    success: true,
    data: formattedEvents
  });
});


