import Challenge from "../models/Challenge.model.js";
import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { devlogImageQueue } from "../queues/devlogImageQueue.js";
import { devlogResourceQueue } from "../queues/devlogResourceQueue.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";

// ─── Phase Engine ──────────────────────────────────────────────────────────
// Single source of truth for phase-based permissions
const PHASE_ENGINE = {
  // Statuses that allow a new user to join/register
  JOINABLE:  ['registration_open', 'submissions_open', 'active'],
  // Statuses that allow an existing participant to submit
  SUBMITTABLE: ['submissions_open', 'active'],
  // Allowed forward-only phase transitions (host cannot go backwards)
  TRANSITIONS: {
    draft:             ['upcoming', 'registration_open', 'cancelled'],
    upcoming:          ['registration_open', 'cancelled'],
    registration_open: ['submissions_open', 'in_review', 'cancelled'],
    submissions_open:  ['in_review', 'completed', 'cancelled'],
    in_review:         ['completed', 'cancelled'],
    completed:         [], // terminal
    cancelled:         [], // terminal
    // Legacy aliases — treat as submissions_open
    active:            ['in_review', 'completed', 'cancelled'],
    published:         ['registration_open', 'submissions_open', 'cancelled'],
  }
};


// ─── Shared $lookup stages (reused in both list & detail) ───────────────
const CRAFTSMAN_LOOKUP = {
  $lookup: {
    from: "users",
    localField: "craftsman",
    foreignField: "_id",
    pipeline: [{ $project: { name: 1, username: 1, profilePicture: 1, isVerified: 1, verificationStatus: 1 } }],
    as: "craftsman"
  }
};
const JUDGES_LOOKUP = {
  $lookup: {
    from: "users",
    localField: "judges",
    foreignField: "_id",
    pipeline: [{ $project: { name: 1, username: 1, profilePicture: 1, tagline: 1, bio: 1 } }],
    as: "judges"
  }
};

/**
 * @desc    Get all challenges
 * @route   GET /api/v1/challenges
 * @access  Public
 *
 * 🚀 OPTIMIZED: O(log n) per lookup — Aggregation pipeline replaces N+1 .populate()
 * Before: 10 challenges × 6 nested .populate() = 1,660+ DB queries
 * After:  3 total queries via $facet (data + count in one round-trip)
 */
export const getChallenges = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const matchStage = {};
    if (req.query.status) matchStage.status = req.query.status;
    if (req.query.payoutStatus) matchStage.payoutStatus = req.query.payoutStatus;
    
    // Filter by craftsman if provided
    if (req.query.craftsman) {
      try {
        matchStage.craftsman = new mongoose.Types.ObjectId(req.query.craftsman);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid craftsman ID format" });
      }
    }

    // 🚀 Single aggregation: data + total in ONE round-trip via $facet
    const [result] = await Challenge.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // ── Data branch ────────────────────────────────────────
          data: [
            { $sort: { status: 1, endDate: 1 } },
            { $skip: skip },
            { $limit: limit },
            // Lightweight counts instead of full subdoc population
            {
              $addFields: {
                submissionsCount: { $size: { $ifNull: ["$submissions", []] } },
                participantsCount: { $size: { $ifNull: ["$participants", []] } },
                winnersCount: { $size: { $ifNull: ["$winners", []] } },
                // Keep winner user IDs for lookup — small array, max 3-5
                winnerIds: {
                  $map: { input: { $ifNull: ["$winners", []] }, as: "w", in: "$$w.user" }
                }
              }
            },
            // Strip heavy subdoc arrays before lookup
            {
              $project: {
                submissions: 0,
                participants: 0,
                winners: 0
              }
            },
            CRAFTSMAN_LOOKUP,
            { $unwind: { path: "$craftsman", preserveNullAndEmptyArrays: true } },
            JUDGES_LOOKUP,
            // Lookup winner users (small set — max 3-5 per challenge)
            {
              $lookup: {
                from: "users",
                localField: "winnerIds",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, profilePicture: 1 } }],
                as: "winners"
              }
            }
          ],
          // ── Count branch ───────────────────────────────────────
          total: [{ $count: "count" }]
        }
      }
    ]);

    const challenges = result?.data || [];
    const total = result?.total?.[0]?.count || 0;

    // 🔒 FAVORITE STATUS: Check if user has favorited these challenges
    let favoriteIds = [];
    if (req.user) {
      const user = await User.findById(req.user._id).select("favorites");
      favoriteIds = user?.favorites || [];
    }

    const data = challenges.map(c => ({
      ...c,
      isFavorited: favoriteIds.some(fid => fid.toString() === c._id.toString())
    }));

    res.status(200).json({
      success: true,
      count: challenges.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + challenges.length < total,
      data
    });

  } catch (error) {
    logger.error("Get Challenges Error:", error);
    res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

/**
 * @desc    Get single challenge (full detail view)
 * @route   GET /api/v1/challenges/:id
 * @access  Public
 *
 * 🚀 OPTIMIZED: 3 targeted $lookup stages replace 1,000+ N+1 queries
 * participants & submissions are batch-populated with $lookup in one pass
 */
export const getChallengeById = async (req, res) => {
  try {
    const mongoose = await import("mongoose");
    const { Types } = mongoose.default || mongoose;
    let challengeId;
    try {
      challengeId = new Types.ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid challenge ID" });
    }

    const [challenge] = await Challenge.aggregate([
      { $match: { _id: challengeId } },
      // 1. Craftsman lookup — O(log n) index scan
      CRAFTSMAN_LOOKUP,
      { $unwind: { path: "$craftsman", preserveNullAndEmptyArrays: true } },
      // 2. Judges lookup — O(log n) $in on _id index
      JUDGES_LOOKUP,
      // 3. Batch lookup participants.user — ONE query for all participants
      {
        $lookup: {
          from: "users",
          localField: "participants.user",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, profilePicture: 1 } }],
          as: "_participantUsers"
        }
      },
      // 4. Batch lookup submissions.user — ONE query for all submitters
      {
        $lookup: {
          from: "users",
          localField: "submissions.user",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, profilePicture: 1 } }],
          as: "_submissionUsers"
        }
      },
      // 5. Re-join participants with fetched user data using $map + $filter (O(p+u))
      {
        $addFields: {
          // Build a userId→user map for O(1) lookup during $map
          _userMap: {
            $arrayToObject: {
              $map: {
                input: "$_participantUsers",
                as: "u",
                in: { k: { $toString: "$$u._id" }, v: "$$u" }
              }
            }
          },
          _submitterMap: {
            $arrayToObject: {
              $map: {
                input: "$_submissionUsers",
                as: "u",
                in: { k: { $toString: "$$u._id" }, v: "$$u" }
              }
            }
          }
        }
      },
      {
        $addFields: {
          participants: {
            $map: {
              input: { $ifNull: ["$participants", []] },
              as: "p",
              in: {
                $mergeObjects: [
                  "$$p",
                  { user: { $getField: { field: { $toString: "$$p.user" }, input: "$_userMap" } } }
                ]
              }
            }
          },
          submissions: {
            $map: {
              input: { $ifNull: ["$submissions", []] },
              as: "s",
              in: {
                $mergeObjects: [
                  "$$s",
                  { user: { $getField: { field: { $toString: "$$s.user" }, input: "$_submitterMap" } } }
                ]
              }
            }
          }
        }
      },
      // Clean up temp fields
      { $project: { _participantUsers: 0, _submissionUsers: 0, _userMap: 0, _submitterMap: 0 } }
    ]);

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    // 🚀 NEW: Fetch real-time craftsman stats for "Host Intel"
    let hostedChallengesCount = 0;
    let trustRating = 4.5; // Base rating
    
    if (challenge.craftsman) {
        hostedChallengesCount = await Challenge.countDocuments({ craftsman: challenge.craftsman._id });
        
        // Trust Rating Formula (Demo Logic):
        // 1. Verified status gives +0.2
        // 2. Each challenge hosted gives +0.05
        // 3. Max cap at 5.0
        if (challenge.craftsman.isVerified) trustRating += 0.2;
        trustRating += Math.min(hostedChallengesCount * 0.05, 0.3);
        trustRating = Math.min(trustRating, 5.0).toFixed(1);
    }

    // 🔒 Favorite Status
    let isFavorited = false;
    if (req.user) {
        const user = await User.findById(req.user._id).select("favorites");
        isFavorited = user?.favorites?.some(fid => fid.toString() === challenge._id.toString());
    }

    // Merge stats into craftsman object
    const finalCraftsman = challenge.craftsman ? {
        ...challenge.craftsman,
        challengesHosted: hostedChallengesCount,
        trustRating: trustRating
    } : null;

    res.status(200).json({ success: true, data: { ...challenge, craftsman: finalCraftsman, isFavorited } });
  } catch (error) {
    logger.error("Get Challenge By ID Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Accept/Join a challenge
 * @route   POST /api/v1/challenges/:id/join
 * @access  Private
 */
export const joinChallenge = async (req, res) => {
    try {
        const { participationType, role, experience, portfolioLink, intent } = req.body;
        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        // ─── Phase Gate: only allow joining in the correct phase ────────────
        if (!PHASE_ENGINE.JOINABLE.includes(challenge.status)) {
            const statusMessages = {
                draft:      'This challenge is not yet published.',
                upcoming:   'Registration has not opened yet.',
                in_review:  'The submission window has closed. Registration is no longer accepted.',
                completed:  'This challenge has ended.',
                cancelled:  'This challenge has been cancelled.',
            };
            const msg = statusMessages[challenge.status] || 'Registration is not currently open for this challenge.';
            return res.status(400).json({ success: false, message: msg });
        }

        // ─── Date Guard: respect registrationEnd even if host forgot to advance phase ─
        const now = new Date();
        const phases = challenge.phases || {};
        if (phases.registrationEnd && now > new Date(phases.registrationEnd) && challenge.status === 'registration_open') {
            return res.status(400).json({ 
                success: false, 
                message: 'The registration period has ended. The host needs to advance the challenge to the next phase.' 
            });
        }

        // ─── Security: Craftsman cannot join their own challenge ──────────────
        if (challenge.craftsman.toString() === req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Hosts cannot participate in their own challenges." });
        }

        const result = await Challenge.updateOne(
            { _id: req.params.id, "participants.user": { $ne: req.user._id } },
            { 
                $addToSet: { 
                    participants: { 
                        user: req.user._id,
                        participationType,
                        role,
                        experience,
                        portfolioLink,
                        intent
                    } 
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(400).json({ success: false, message: "You have already accepted this challenge" });
        }

        res.status(200).json({
            success: true,
            message: "Challenge accepted successfully! Good luck."
        });

    } catch (error) {
        logger.error("Join Challenge Error:", error);
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
        const { 
            title,
            tagline, 
            fullBrief,
            githubLink,
            accessibleLink,
            liveUrl,
            devlogLink, 
            repoLink, 
            videoLink, 
            techStack,
            description,
            resources: rawResources
        } = req.body;

        // githubLink is required
        if (!githubLink || !githubLink.trim()) {
            return res.status(400).json({ success: false, message: "GitHub report link is required." });
        }

        const challenge = await Challenge.findById(req.params.id);
        
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        // ─── Phase Gate: only allow submissions in the correct phase ────────
        if (!PHASE_ENGINE.SUBMITTABLE.includes(challenge.status)) {
            const statusMessages = {
                draft:             'This challenge is not yet published.',
                upcoming:          'The challenge has not started yet.',
                registration_open: 'The submission window is not open yet. Please wait for the submission phase.',
                in_review:         'The submission deadline has passed. Entries are being reviewed.',
                completed:         'This challenge has ended.',
                cancelled:         'This challenge has been cancelled.',
            };
            const msg = statusMessages[challenge.status] || 'Submissions are not currently accepted for this challenge.';
            return res.status(400).json({ success: false, message: msg });
        }

        // ─── Date Guard: enforce submission deadline ────────────────────────
        const now = new Date();
        const phases = challenge.phases || {};
        const submissionDeadline = phases.submissionEnd || challenge.endDate;
        if (submissionDeadline && now > new Date(submissionDeadline)) {
            return res.status(400).json({ 
                success: false, 
                message: 'The submission deadline has passed.' 
            });
        }

        // ─── Security: Craftsman cannot submit to their own challenge ─────────
        if (challenge.craftsman.toString() === req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Hosts cannot submit artifacts to their own challenges." });
        }

        // Must be a participant first
        const checkStatus = await Challenge.findOne({
            _id: req.params.id,
            "participants.user": req.user._id
        }).select("submissions.user");

        if (!checkStatus) {
            return res.status(403).json({ success: false, message: "You must accept the challenge before submitting" });
        }

        const submissions = checkStatus.submissions || [];
        const alreadySubmitted = submissions.find(s => s.user && s.user.toString() === req.user._id.toString());
        if (alreadySubmitted) {
             return res.status(400).json({ success: false, message: "You have already submitted an entry" });
        }

        // Parse resources (may be JSON string or already array)
        const safeParse = (data, fallback = []) => {
            if (!data) return fallback;
            try { return typeof data === 'string' ? JSON.parse(data) : data; }
            catch { return fallback; }
        };
        let resources = safeParse(rawResources, []);

        // Handle File Uploads (Screenshots + resource files)
        let screenshots = [];

        if (req.files) {
            if (req.files.screenshots) {
                logger.info(`Uploading ${req.files.screenshots.length} screenshots to Cloudinary...`);
                for (const file of req.files.screenshots) {
                    try {
                        const shotResult = await cloudinary.uploader.upload(file.path, { folder: "submissions/screenshots" });
                        screenshots.push(shotResult.secure_url);
                        fs.unlinkSync(file.path);
                    } catch (uploadErr) {
                        logger.error(`Screenshot upload failed: ${uploadErr.message}`);
                        throw new Error(`Visual Proof upload failed: ${uploadErr.message}`);
                    }
                }
            }

            // Handle resource files: matched by FILE_0, FILE_1 placeholder in resources array
            if (req.files.resourceFiles) {
                logger.info(`Uploading ${req.files.resourceFiles.length} resource files to Cloudinary...`);
                for (let i = 0; i < req.files.resourceFiles.length; i++) {
                    const file = req.files.resourceFiles[i];
                    try {
                        const result = await cloudinary.uploader.upload(file.path, {
                            folder: "submissions/resources",
                            resource_type: "auto"
                        });
                        const placeholder = `FILE_${i}`;
                        const idx = resources.findIndex(r => r.url === placeholder);
                        if (idx !== -1) {
                            resources[idx].url = result.secure_url;
                        }
                        fs.unlinkSync(file.path);
                    } catch (uploadErr) {
                        logger.error(`Resource file upload failed: ${uploadErr.message}`);
                        throw new Error(`Devlog Resource upload failed: ${uploadErr.message}`);
                    }
                }
            }
        }

        challenge.submissions.push({
            user: req.user._id,
            title: title || "",
            tagline: tagline || "",
            fullBrief: fullBrief || "",
            githubLink: githubLink.trim(),
            accessibleLink: accessibleLink || "",
            liveUrl: liveUrl || "",
            devlogLink: liveUrl || devlogLink || "",   // backward compat
            repoLink: githubLink || repoLink || "",      // backward compat
            videoLink: videoLink || "",
            techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(s => s.trim()) : []),
            screenshots,
            description: fullBrief || description || "",
            resources
        });

        await challenge.save();

        res.status(200).json({
            success: true,
            message: "Entry submitted successfully! Good luck."
        });

    } catch (error) {
        logger.error(`Submit Challenge Error [Challenge: ${req.params.id}]: ${error.message}`);
        if (error.stack) logger.error(error.stack);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error during submission",
            error: error.message 
        });
    }
};



/**
 * @desc    Create Challenge (Host/Admin)
 * @route   POST /api/v1/challenges
 */
export const createChallenge = async (req, res) => {
    try {
        // Authorization Check
        if (!req.user.isHost && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: "You are not authorized to host challenges. Please apply for verification first." 
            });
        }

        const { 
            title, 
            description, 
            type, 
            prize, 
            phases: rawPhases,
            judges: rawJudges,
            sponsorLogos: rawSponsorLogos,
            faq: rawFaq,
            rules: rawRules, 
            requirements: rawRequirements,
            rewardDistribution: rawDistribution,
            milestones: rawMilestones,
            judgingCriteria: rawCriteria,
            resources: rawResources,
            submissionRequirements: rawSubReq,
            prizeDetails: rawPrizeDetails,
            category,
            difficulty,
            tags: rawTags,
            techStack: rawTechStack,
            teamConfiguration: rawTeamConfig,
            visibility: rawVisibility
        } = req.body;

        // Safe parse helper for JSON strings
        const safeParse = (data, fallback = []) => {
            if (!data) return fallback;
            try {
                return typeof data === 'string' ? JSON.parse(data) : data;
            } catch (err) {
                logger.warn(`JSON Parse failed for field. Received: ${data.substring(0, 20)}...`);
                return fallback;
            }
        };

        const rewardDistribution = safeParse(rawDistribution);
        const milestones = safeParse(rawMilestones);
        const judgingCriteria = safeParse(rawCriteria);
        const resources = safeParse(rawResources);
        const submissionRequirements = safeParse(rawSubReq, {});
        const rules = safeParse(rawRules);
        const requirements = safeParse(rawRequirements);
        const prizeDetails = safeParse(rawPrizeDetails, { first: "", second: "", third: "" });
        const phases = safeParse(rawPhases, {});
        const judges = safeParse(rawJudges, []);
        const sponsorLogos = safeParse(rawSponsorLogos, []);
        const faq = safeParse(rawFaq, []);
        const tags = safeParse(rawTags, []);
        const techStack = safeParse(rawTechStack, { allowed: [], avoid: [] });
        const teamConfiguration = safeParse(rawTeamConfig, { participationType: 'Solo', minTeamSize: 1, maxTeamSize: 1 });
        const visibility = safeParse(rawVisibility, { isPublic: true, allowedLevels: [], allowedUsers: [], blockedUsers: [] });

        // Calculate total tokens for the prize pool
        const totalTokens = rewardDistribution.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        let coverImageUrl = null;
        const files = req.files || {};

        if (!files['coverImage']?.[0]) {
            return res.status(400).json({ success: false, message: "Cover image is required" });
        }

        const challengeData = {
            title,
            description,
            type,
            prize,
            prizePool: totalTokens,
            rewardDistribution,
            milestones,
            judgingCriteria,
            resources,
            submissionRequirements,
            phases,
            startDate: phases.registrationStart || Date.now(),
            endDate: phases.winnerAnnouncement || Date.now(),
            sponsorLogos,
            faq,
            judges,
            coverImage: null, // Set via craftsman
            craftsman: req.user._id,
            rules,
            requirements,
            prizeDetails,
            category,
            difficulty,
            tags,
            techStack,
            teamConfiguration,
            visibility
        };

        const challenge = await Challenge.create(challengeData);

        // Queue Cover Image Upload
        if (files['coverImage']?.[0]) {
            await devlogImageQueue.add("post-image-upload", {
                filePath: files['coverImage'][0].path,
                postId: challenge._id,
                userId: req.user._id,
                targetType: "Challenge_Cover"
            });
        }

        // Queue Resource Files
        if (files['resourceFiles']?.length > 0) {
            for (let i = 0; i < files['resourceFiles'].length; i++) {
                const file = files['resourceFiles'][i];
                // Match with placeholder if exists, otherwise just originalName
                const placeholder = `FILE_${i}`;
                const resItem = resources.find(r => r.url === placeholder) || resources.find(r => r.name === file.originalname);
                
                await devlogResourceQueue.add("devlog-resource-upload", {
                    filePath: file.path,
                    postId: challenge._id,
                    userId: req.user._id,
                    originalName: resItem ? resItem.name : file.originalname,
                    targetType: "Challenge_Craftsman_Resource"
                });
            }
        }
        res.status(201).json({ success: true, data: challenge });
    } catch (error) {
        logger.error("Create Challenge Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * @desc    Add announcement/update to challenge
 * @route   POST /api/v1/challenges/:id/updates
 * @access  Private (Craftsman Only)
 */
export const addChallengeUpdate = async (req, res) => {
    try {
        const { content } = req.body;
        const challenge = await Challenge.findById(req.params.id);

        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        // Only craftsman can add updates
        if (challenge.craftsman.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the host can add updates" });
        }

        challenge.updates.unshift({ content });
        await challenge.save();

        res.status(200).json({ success: true, data: challenge.updates });
    } catch (error) {
        logger.error("Add Challenge Update Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    End/Complete challenge
 * @route   PATCH /api/v1/challenges/:id/status
 * @access  Private (Craftsman Only)
 */
export const updateChallengeStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const challenge = await Challenge.findById(req.params.id);

        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        // ─── Authorization ──────────────────────────────────────────────────
        const isOwner = challenge.craftsman.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Only the host or an admin can change the phase." });
        }

        // ─── Validate the transition ────────────────────────────────────────
        const currentStatus = challenge.status;
        const allowed = PHASE_ENGINE.TRANSITIONS[currentStatus] || [];

        if (allowed.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: `The challenge is in a terminal state (${currentStatus}) and cannot be changed.` 
            });
        }

        if (!allowed.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid phase transition: '${currentStatus}' → '${status}'. Allowed next phases: [${allowed.join(', ')}].` 
            });
        }

        // ─── Apply the transition ───────────────────────────────────────────
        challenge.status = status;
        challenge.lastPhaseUpdatedAt = new Date();

        // If marking completed, auto-set payout to pending
        if (status === 'completed' && challenge.payoutStatus === 'pending') {
            challenge.payoutStatus = 'pending'; // already default, but explicit
        }

        await challenge.save();

        res.status(200).json({ success: true, data: challenge, message: `Challenge advanced to '${status}'.` });
    } catch (error) {
        logger.error("Update Challenge Status Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Update challenge phase dates (Host Only)
 * @route   PATCH /api/v1/challenges/:id/phases
 * @access  Private (Craftsman Only)
 */
export const updateChallengePhases = async (req, res) => {
    try {
        const { phases } = req.body;
        const challenge = await Challenge.findById(req.params.id);

        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        const isOwner = challenge.craftsman.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Only the host can update phase dates." });
        }

        // Cannot edit phases of a completed or cancelled challenge
        if (['completed', 'cancelled'].includes(challenge.status)) {
            return res.status(400).json({ success: false, message: "Phase dates cannot be changed for a terminal challenge." });
        }

        // Validate date ordering if all dates provided
        const p = { ...challenge.phases?.toObject?.() || challenge.phases || {}, ...phases };
        const dateChecks = [
            [p.registrationStart, p.registrationEnd, 'registrationStart must be before registrationEnd'],
            [p.registrationEnd, p.submissionStart, 'registrationEnd must be before submissionStart'],
            [p.submissionStart, p.submissionEnd, 'submissionStart must be before submissionEnd'],
            [p.submissionEnd, p.judgingStart, 'submissionEnd must be before judgingStart'],
            [p.judgingStart, p.judgingEnd, 'judgingStart must be before judgingEnd'],
        ];
        for (const [start, end, msg] of dateChecks) {
            if (start && end && new Date(start) >= new Date(end)) {
                return res.status(400).json({ success: false, message: msg });
            }
        }

        challenge.phases = p;
        // Sync endDate with submissionEnd for backward compatibility
        if (p.submissionEnd) challenge.endDate = new Date(p.submissionEnd);
        await challenge.save();

        res.status(200).json({ success: true, data: challenge, message: 'Phase schedule updated successfully.' });
    } catch (error) {
        logger.error('Update Challenge Phases Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    Select winners for challenge
 * @route   POST /api/v1/challenges/:id/winners
 * @access  Private (Craftsman Only)
 */
export const selectWinners = async (req, res) => {
    try {
        const { winners } = req.body; // Array of { rank, user, submissionId }
        const challenge = await Challenge.findById(req.params.id);

        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        if (challenge.craftsman.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the host can select winners" });
        }

        // Block ONLY if payouts have already been distributed — allow re-assignment before that
        if (challenge.payoutStatus === "distributed") {
            return res.status(400).json({ success: false, message: "Payouts have already been distributed. Winners cannot be changed." });
        }

        // Allow winner assignment in in_review and completed states
        const ASSIGNABLE_STATUSES = ["in_review", "completed"];
        if (!ASSIGNABLE_STATUSES.includes(challenge.status)) {
            return res.status(400).json({ success: false, message: `Winner assignment is only available when challenge is in review or completed. Current status: ${challenge.status}` });
        }

        challenge.winners = winners;
        // Only advance to completed from in_review; if already completed, keep status as-is
        if (challenge.status === "in_review") {
            challenge.status = "completed";
        }
        // Only reset payout to pending if it wasn't already pending (avoid overwriting)
        if (challenge.payoutStatus !== "pending" && challenge.payoutStatus !== "distributed") {
            challenge.payoutStatus = "pending";
        }
        await challenge.save();

        res.status(200).json({ 
            success: true, 
            message: "Winners selected. Payout is pending platform review (1-3 days).",
            data: challenge 
        });
    } catch (error) {
        logger.error("Select Winners Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Release payouts for challenge winners (Admin Only)
 * @route   POST /api/v1/challenges/:id/payout
 * @access  Private (Admin Only)
 */
export const releasePayouts = async (req, res) => {
    try {
        // Permission check (adminOnly middleware already handles this, but we'll double check)
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && !req.user.isSuperAdmin) {
            return res.status(403).json({ success: false, message: "Access denied. Admin only." });
        }

        const challenge = await Challenge.findById(req.params.id).populate("winners.user");
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        if (challenge.payoutStatus === "distributed") {
            return res.status(400).json({ success: false, message: "Payouts already distributed" });
        }

        if (challenge.status !== "completed") {
            return res.status(400).json({ success: false, message: "Challenge must be completed before payouts" });
        }

        // Transfer tokens from Platform pool to each winner
        for (const winner of challenge.winners) {
            const dist = challenge.rewardDistribution.find(d => d.rank === winner.rank);
            const rewardAmount = dist ? dist.amount : 0;

            if (rewardAmount > 0 && !winner.payoutReleased) {
                const winnerUser = await User.findById(winner.user._id);
                if (winnerUser) {
                    winnerUser.walletBalance += rewardAmount;
                    winnerUser.totalEarnings += rewardAmount;
                    await winnerUser.save();

                    // Log Transaction
                    await TokenTransaction.create({
                        user: winnerUser._id,
                        amount: rewardAmount,
                        type: "reward",
                        source: "challenge_reward",
                        referenceId: challenge._id,
                        status: "completed",
                        description: `Platform Reward: Rank ${winner.rank} in challenge: ${challenge.title}`
                    });

                    winner.payoutReleased = true;
                }
            }
        }

        challenge.payoutStatus = "distributed";
        await challenge.save();

        res.status(200).json({ success: true, message: "Payouts released successfully", data: challenge });
    } catch (error) {
        logger.error("Release Payouts Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Like a submission
 * @route   POST /api/v1/challenges/:challengeId/submissions/:submissionId/like
 * @access  Private
 */
export const likeSubmission = async (req, res) => {
    try {
        const challenge = await Challenge.findById(req.params.challengeId);
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        const submission = challenge.submissions.id(req.params.submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: "Submission not found" });
        }

        const isLiked = submission.likes.some(id => id.toString() === req.user._id.toString());
        
        const update = isLiked 
            ? { $pull: { "submissions.$.likes": req.user._id } }
            : { $addToSet: { "submissions.$.likes": req.user._id } };

        await Challenge.updateOne(
            { _id: req.params.challengeId, "submissions._id": req.params.submissionId },
            update
        );
        
        const updatedChallenge = await Challenge.findById(req.params.challengeId);
        const updatedSubmission = updatedChallenge.submissions.id(req.params.submissionId);

        res.status(200).json({ 
            success: true, 
            likes: updatedSubmission.likes.length, 
            hasLiked: !isLiked 
        });

    } catch (error) {
        logger.error("Like Submission Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const scoreSubmission = async (req, res) => {
    try {
        const { id, submissionId } = req.params;
        const { scores, totalScore, feedback } = req.body;

        const challenge = await Challenge.findById(id);
        if (!challenge) {
            return res.status(404).json({ success: false, message: "Challenge not found" });
        }

        // Verify judge (must be admin or in judges array)
        const isJudge = challenge.judges.some(judgeId => judgeId.toString() === req.user._id.toString());
        if (!isJudge && req.user.role !== 'admin' && challenge.craftsman.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to judge this challenge" });
        }

        const submission = challenge.submissions.id(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: "Submission not found" });
        }

        // Check if judge has already scored
        const existingScoreIndex = submission.evaluationScores.findIndex(es => es.judge.toString() === req.user._id.toString());

        if (existingScoreIndex > -1) {
            // Update existing score
            submission.evaluationScores[existingScoreIndex].scores = scores;
            submission.evaluationScores[existingScoreIndex].totalScore = totalScore;
            submission.evaluationScores[existingScoreIndex].feedback = feedback;
        } else {
            // Add new score
            submission.evaluationScores.push({
                judge: req.user._id,
                scores,
                totalScore,
                feedback
            });
        }

        await challenge.save();

        res.status(200).json({ success: true, message: "Score submitted successfully", submission });
    } catch (error) {
        logger.error("Score Submission Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


