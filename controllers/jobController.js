import Job from "../models/Job.model.js";
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import Transaction from "../models/Transaction.model.js";
import logger from "../utils/logger.js";
import Joi from "joi";
import mongoose from "mongoose";

const STAGE_ORDER = [
  "proposal_sent",
  "under_review",
  "shortlisted",
  "interview",
  "offer_sent",
  "hired",
  "paused",
  "rejected",
  "trash"
];

import { parseAmount } from "../utils/amountParser.js";

// ── VALIDATION SCHEMAS ────────────────────────────────────────────────────────
const jobSchema = Joi.object({
  title:       Joi.string().required().trim().max(100),
  description: Joi.string().required().min(20).max(5000),
  category:    Joi.string().default("Development"),
  skills:      Joi.array().items(Joi.string()).max(15),
  budget: Joi.object({
    min:      Joi.number().required().min(0),
    max:      Joi.number().required().min(Joi.ref("min")),
    type:     Joi.string().valid("fixed", "hourly").default("fixed"),
    currency: Joi.string().default("TKNS")
  }).required(),
  level:    Joi.string().valid("Entry", "Intermediate", "Expert").default("Intermediate"),
  location: Joi.string().default("Remote"),
  deadline: Joi.date().greater("now").allow(null),
  status:   Joi.string().valid("open", "in_progress", "closed")
});

const proposalSchema = Joi.object({
  coverLetter:   Joi.string().required().min(50).max(10000),
  expectedRate:  Joi.number().required().min(1),
  rateType:      Joi.string().valid("fixed", "hourly").required(),
  availability:  Joi.string().required(),
  estimatedDays: Joi.number().min(1),
  portfolioLinks: Joi.array().items(Joi.object({
    url:   Joi.string().uri().required(),
    label: Joi.string().allow("")
  })).max(10)
});

/**
 * @desc    Create a new job posting
 * @route   POST /api/v1/jobs
 * @access  Private (patron / Admin)
 */
export const createJob = async (req, res) => {
  try {
    const { error, value } = jobSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const job = await Job.create({
      patron: req.user._id,
      ...value
    });

    await job.populate("patron", "name username profilePicture createdAt isVerified"); // Privacy: Removed email from population

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    logger.error("Create Job Error:", error);
    res.status(500).json({ success: false, message: "Failed to create job" });
  }
};

/**
 * @desc    Get all jobs with filtering
 * @route   GET /api/v1/jobs
 * @access  Public
 */
export const getJobs = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    // 🔒 SECURITY: If requesting all jobs or a specific patron's jobs, verify permissions
    const requestingPatron = req.query.patron;
    const isSensitiveRequest = req.query.status === "all" || requestingPatron;

    if (isSensitiveRequest && requestingPatron) {
      const isOwner = req.user && req.user._id.toString() === requestingPatron;
      const isAdmin = req.user && req.user.role === "admin";

      // If not owner/admin, they can only see public 'open' jobs of that patron
      if (!isOwner && !isAdmin && req.query.status === "all") {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized: You can only manage your own job postings." 
        });
      }
    }

    // Build query
    let query = req.query.status === "all" ? {} : { status: { $in: ["open", "in_progress"] } };
    if (requestingPatron)   query.patron   = requestingPatron;
    if (req.query.category) query.category = req.query.category;
    if (req.query.level)    query.level    = req.query.level;
    if (req.query.type)     query["budget.type"] = req.query.type;

    // 🔒 SECURE SEARCH: Prevent ReDoS by using $text search first
    if (req.query.q) {
      const sanitizedQ = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Basic sanitize
      
      try {
        // Try high-performance text search
        query.$text = { $search: req.query.q };
      } catch (err) {
        // Fallback to safe, anchored regex if index fails
        query.$or = [
          { title:       { $regex: `^${sanitizedQ}`, $options: "i" } },
          { description: { $regex: sanitizedQ, $options: "i" } }
        ];
      }
    }

    let queryExec = Job.find(query)
      .populate("patron", "name username profilePicture createdAt isVerified")
      .sort(req.query.q ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 🚀 Management View: If status=all, we need all applicant details + proposals
    if (req.query.status === "all") {
      queryExec = queryExec.populate("applicants.user", "name username displayName profilePicture avatar bio createdAt");
    } else {
      queryExec = queryExec.select("-applicants.proposal -applicants.stageHistory -applicants.patronNote");
    }

    const jobs = await queryExec.lean();

    const total = await Job.countDocuments(query);

    // 🔒 FAVORITE STATUS: Check if user has favorited these jobs
    let favoriteIds = [];
    if (req.user) {
      const user = await User.findById(req.user._id).select("favorites");
      favoriteIds = user?.favorites || [];
    }

    const jobsFormatted = jobs.map(job => ({
      ...job,
      patron: {
        _id:    job.patron?._id,
        name:   job.patron?.name,
        username: job.patron?.username,
        avatar: job.patron?.profilePicture || "",
      },
      applicantCount: job.applicants ? job.applicants.length : 0,
      isFavorited: favoriteIds.some(fid => fid.toString() === job._id.toString())
    }));

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobsFormatted,
      page,
      hasMore: skip + jobs.length < total
    });
  } catch (error) {
    logger.error("Get Jobs Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch jobs" });
  }
};

/**
 * @desc    Get single job details
 * @route   GET /api/v1/jobs/:id
 * @access  Public
 */
export const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("patron", "name username profilePicture email lastActiveAt createdAt isVerified")
      .populate("applicants.user", "name username profilePicture email displayName skills bio gamification createdAt")
      .populate("applicants.offer");

    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    // 🩹 Self-healing: If an applicant has an offer_sent but no offer link, try to find it (OPTIMIZED: Batch Fetching)
    const candidatesForOffer = job.applicants.filter(a => a.stage === "offer_sent" && !a.offer);
    let needsSave = false;
    
    if (candidatesForOffer.length > 0) {
      const craftsmanIds = candidatesForOffer.map(a => a.user?._id || a.user);
      const contracts = await Contract.find({ 
        job: job._id, 
        craftsman: { $in: craftsmanIds },
        status: "pending"
      }).select("_id craftsman").lean();

      const contractMap = new Map(contracts.map(c => [c.craftsman.toString(), c._id]));

      for (const applicant of candidatesForOffer) {
        const craftsmanId = (applicant.user?._id || applicant.user).toString();
        const contractId = contractMap.get(craftsmanId);
        if (contractId) {
          applicant.offer = contractId;
          needsSave = true;
        }
      }
    }

    if (needsSave) await job.save();

    const jobData = job.toObject();

    // Fetch Patron Job Stats
    if (job.patron) {
      const patronId = job.patron._id;
      const [activeJobs, completedJobs] = await Promise.all([
        Job.countDocuments({ patron: patronId, status: { $in: ["open", "in_progress"] } }),
        Job.countDocuments({ patron: patronId, status: "closed" })
      ]);
      jobData.patronStats = {
        active: activeJobs,
        completed: completedJobs,
        cancelled: 0 // Add cancelled jobs logic later if the schema changes to support it
      };
    }

    // 🛡️ Privacy: Only show patron email to the owner or admins
    const isAuthorized = req.user && job.patron && (
      req.user.role === "admin" || 
      job.patron._id.toString() === req.user._id.toString()
    );

    jobData.patron = job.patron ? {
      _id:          job.patron._id,
      name:         job.patron.name,
      avatar:       job.patron.profilePicture || "",
      email:        isAuthorized ? job.patron.email : undefined,
      lastActiveAt: job.patron.lastActiveAt
    } : null;
    jobData.applicantCount = job.applicants ? job.applicants.length : 0;
    
    // 🔒 Favorite Status
    if (req.user) {
        const user = await User.findById(req.user._id).select("favorites");
        jobData.isFavorited = user?.favorites?.some(fid => fid.toString() === job._id.toString());
    }

    res.status(200).json({ success: true, data: jobData });
  } catch (error) {
    logger.error("Get Job Detail Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * @desc    Update a job posting
 * @route   PATCH /api/v1/jobs/:id
 * @access  Private (Owner / Admin)
 */
export const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    if (job.patron.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized to edit this job" });
    }

    const { title, description, category, skills, budget, level, location, deadline, status } = req.body;
    if (title)       job.title       = title;
    if (description) job.description = description;
    if (category)    job.category    = category;
    if (skills)      job.skills      = skills;
    if (budget)      job.budget      = budget;
    if (level)       job.level       = level;
    if (location)    job.location    = location;
    if (deadline !== undefined) job.deadline = deadline;
    if (status)      job.status      = status;

    await job.save();
    await job.populate("patron", "name username profilePicture email createdAt");

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    logger.error("Update Job Error:", error);
    res.status(500).json({ success: false, message: "Failed to update job" });
  }
};

/**
 * @desc    Submit a proposal for a job (replaces simple "apply")
 * @route   POST /api/v1/jobs/:id/apply
 * @access  Private
 */
export const applyToJob = async (req, res) => {
  try {
    const jobId  = req.params.id;
    const userId = req.user._id;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    if (job.status !== "open") {
      return res.status(400).json({ success: false, message: "This job is no longer accepting proposals" });
    }

    // Cannot apply to own job
    if (job.patron.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: "You cannot apply to your own job" });
    }

    // Already applied?
    const alreadyApplied = job.applicants.find(a => a.user.toString() === userId.toString());
    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: "You have already submitted a proposal" });
    }

    const { error, value } = proposalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    // 🪙 TOKEN ECONOMY: 1 Token Application Fee
    const user = await User.findById(userId);
    if (user.walletBalance < 1) {
      return res.status(403).json({ 
        success: false, 
        message: "Insufficient Tokens. You need at least 1 token to apply. Complete challenges to earn more." 
      });
    }

    // Deduct token
    const previousBalance = user.walletBalance;
    user.walletBalance -= 1;
    await user.save();

    // Log deduction
    await TokenTransaction.create({
      user: userId,
      amount: 1,
      type: "spend",
      source: "job_application",
      description: `Application fee for job: ${job.title}`,
      metadata: {
        jobId: job._id,
        previousBalance,
        newBalance: user.walletBalance
      }
    });

    job.applicants.push({
      user:  userId,
      stage: "proposal_sent",
      proposal: { ...value, portfolioLinks: value.portfolioLinks || [] },
      stageHistory: [{ stage: "proposal_sent", note: "Proposal submitted" }]
    });

    await job.save();

    res.status(200).json({ success: true, message: "Proposal submitted successfully" });
  } catch (error) {
    logger.error("Apply Job Error:", error);
    res.status(500).json({ success: false, message: "Failed to submit proposal" });
  }
};

/**
 * @desc    Update an applicant's pipeline stage (patron action)
 * @route   PATCH /api/v1/jobs/:id/applicants/:applicantId/stage
 * @access  Private (Job owner / Admin)
 */
export const updateApplicantStage = async (req, res) => {
  try {
    const { id: jobId, applicantId } = req.params;
    const { stage, note } = req.body;

    if (!STAGE_ORDER.includes(stage)) {
      return res.status(400).json({ success: false, message: `Invalid stage: ${stage}` });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    if (job.patron.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const applicant = job.applicants.id(applicantId);
    if (!applicant) return res.status(404).json({ success: false, message: "Applicant not found" });

    // Handle Formal Offer Data
    if (stage === "offer_sent") {
      if (req.body.offerId) {
        applicant.offer = req.body.offerId;
      } else if (req.body.offer) {
        applicant.proposal.offer = {
          ...req.body.offer,
          draftedAt: new Date()
        };
      }
    }

    applicant.stage = stage;
    applicant.stageHistory.push({ stage, note: note || (stage === "offer_sent" ? "Hiring agreement extended" : "") });

    // If hired directly (legacy or admin override) → create basic contract
    if (stage === "hired") {
      const { agreedBudget, budgetType } = req.body;
      await Contract.create({
        job:          jobId,
        patron:  job.patron,
        craftsman:    applicant.user,
        agreedBudget: agreedBudget || applicant.offer?.agreedBudget || job.budget.max,
        budgetType:   budgetType   || applicant.offer?.budgetType   || job.budget.type,
        scope:        applicant.offer?.scope,
        milestones:   applicant.offer?.milestones,
        legalTerms:   applicant.offer?.legalTerms,
        timeline:     applicant.offer?.timeline
      });
      if (job.status === "open") job.status = "in_progress";
    }

    await job.save();

    res.status(200).json({ success: true, data: applicant });
  } catch (error) {
    logger.error("Update Stage Error:", error);
    res.status(500).json({ success: false, message: "Failed to update stage" });
  }
};

/**
 * @desc    Get all proposals submitted by the logged-in craftsman
 * @route   GET /api/v1/jobs/my-proposals
 * @access  Private
 */
export const getMyProposals = async (req, res) => {
  try {
    const jobs = await Job.find({ "applicants.user": req.user._id })
      .populate("patron", "name username profilePicture createdAt")
      .populate("applicants.offer")
      .select("title category status patron applicants") // Only fetch needed fields
      .lean();

    const userIdStr = req.user._id.toString();

    const proposals = jobs.map(job => {
      // Find the current user's application in the job's applicants list
      const applicant = job.applicants.find(a => (a.user?._id || a.user).toString() === userIdStr);
      return {
        _id:          applicant._id, // Add applicant ID
        jobId:        job._id,
        applicationId: applicant._id,
        jobTitle:     job.title,
        jobCategory:  job.category,
        jobStatus:    job.status,
        patron:  job.patron,
        stage:        applicant.stage,
        stageHistory: applicant.stageHistory,
        proposal:     applicant.proposal,
        offer:        applicant.offer,
        appliedAt:    applicant.appliedAt
      };
    });

    res.status(200).json({ success: true, data: proposals });
  } catch (error) {
    logger.error("Get My Proposals Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch proposals" });
  }
};

/**
 * @desc    Get detailed proposal info by unique applicant/application ID
 * @route   GET /api/v1/jobs/proposals/:id
 * @access  Private (Owner / Applicant / Admin)
 */
export const getProposalById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the job that contains this applicant ID
    const job = await Job.findOne({ "applicants._id": id })
      .populate("patron", "name username profilePicture email createdAt")
      .populate("applicants.user", "name username profilePicture email displayName skills bio avatar createdAt")
      .populate("applicants.offer");

    if (!job) return res.status(404).json({ success: false, message: "Proposal not found" });

    const applicant = job.applicants.id(id);
    if (!applicant) return res.status(404).json({ success: false, message: "Applicant not found" });

    // Authorization check
    const isOwner = job.patron && job.patron._id.toString() === req.user._id.toString();
    const isApplicant = (applicant.user?._id || applicant.user).toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isApplicant && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to view this proposal" });
    }

    res.status(200).json({ 
      success: true, 
      data: {
        jobId: job._id,
        jobTitle: job.title,
        jobCategory: job.category,
        jobStatus: job.status,
        patron: job.patron || null,
        applicant: applicant
      } 
    });
  } catch (error) {
    logger.error("Get Proposal By Id Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch proposal details" });
  }
};

/**
 * @desc    Accept a formal hiring offer (Craftsman action)
 * @route   POST /api/v1/jobs/:id/applicants/accept-offer
 * @access  Private (Applicant only)
 */
export const acceptOffer = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user._id;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    logger.info(`[acceptOffer] Job: ${jobId}, User: ${userId}`);

    const applicant = job.applicants.find(a => a.user.toString() === userId.toString());
    if (!applicant) return res.status(404).json({ success: false, message: "Proposal not found" });

    if (applicant.stage !== "offer_sent") {
      logger.warn(`[acceptOffer] Invalid stage: ${applicant.stage}`);
      return res.status(400).json({ success: false, message: "No active offer to accept" });
    }

    // Move to hired
    applicant.stage = "hired";
    applicant.stageHistory.push({ stage: "hired", note: "Offer accepted by craftsman" });

    // Check for existing contract for this specific offer to prevent duplicates (Idempotency)
    let contract;
    if (applicant.offer) {
      contract = await Contract.findById(applicant.offer);
      logger.info(`[acceptOffer] Found existing contract: ${contract?._id}`);
    }

    const offerData = applicant.proposal?.offer || {};
    logger.info(`[acceptOffer] Offer Data Milestones: ${offerData.milestones?.length || 0}`);

    if (contract) {
      // Update existing contract instead of creating a new one
      contract.status = "active";
      contract.craftsmanAccepted = true;
      contract.patronAccepted = true;
      // Re-sync milestones ONLY if they don't already exist or if offerData has fresh ones
      // BUT we should be careful not to wipe out existing milestones that might have progress
      if (!contract.milestones || contract.milestones.length === 0) {
        contract.milestones = (offerData.milestones || []).map(m => ({
          ...m,
          status: m.status || "pending",
          isAutoFunded: !!m.isAutoFunded,
          isInitial: !!m.isInitial,
          isAutoBalance: !!m.isAutoBalance
        }));
      }
    } else {
      // Create formal contract if somehow it doesn't exist
      contract = await Contract.create({
        job:          jobId,
        title:        job.title,
        description:  job.description || job.title,
        patron:  job.patron,
        craftsman:    userId,
        agreedBudget: String(offerData.agreedBudget || job.budget.max || 0),
        budgetType:   offerData.budgetType   || (job.budget.type === "Fixed Price" ? "fixed" : "hourly"),
        scope:        offerData.scope,
        milestones:   (offerData.milestones || []).map(m => ({
          ...m,
          status: "pending",
          isAutoFunded: !!m.isAutoFunded,
          isInitial: !!m.isInitial,
          isAutoBalance: !!m.isAutoBalance
        })),
        legalTerms:   offerData.legalTerms,
        timeline:     offerData.timeline,
        status:       "active", 
        craftsmanAccepted: true,
        patronAccepted: true
      });
      applicant.offer = contract._id;
    }

    logger.info(`[acceptOffer] Contract active: ${contract._id}, Status: ${contract.status}`);

    // 🚀 Automated Escrow Funding for Initial Milestones
    const autoFundMilestones = contract.milestones.filter(m => 
      (m.isInitial || m.isAutoFunded) && !m.isFunded
    );

    logger.info(`[acceptOffer] Auto-fund targets: ${autoFundMilestones.length}`);

    if (autoFundMilestones.length > 0) {
      let totalToFund = 0;
      autoFundMilestones.forEach(m => {
        totalToFund += parseAmount(m.amount);
      });

      logger.info(`[acceptOffer] Total to fund: ${totalToFund}`);

      if (totalToFund > 0) {
        const patron = await User.findOneAndUpdate(
          { _id: contract.patron, walletBalance: { $gte: totalToFund } },
          { $inc: { walletBalance: -totalToFund } },
          { new: true }
        );

        if (patron) {
          logger.info(`[acceptOffer] Wallet deduction success. New balance: ${patron.walletBalance}`);
          autoFundMilestones.forEach(m => {
            m.isFunded = true;
            m.amountFunded = parseAmount(m.amount);
            m.status = "funded";
          });

          contract.escrowBalance += totalToFund;
          
          await Transaction.create({
            contract: contract._id,
            fromUser: contract.patron,
            amount: totalToFund,
            type: "deposit",
            status: "completed",
            paymentGateway: "token_internal",
            gatewayTransactionId: `AUTO-HIRE-${Date.now()}`,
            metadata: { 
              milestoneIds: autoFundMilestones.map(m => m._id),
              autoFunded: true,
              trigger: "offer_acceptance"
            }
          });

          await TokenTransaction.create({
            user: contract.patron,
            amount: totalToFund,
            type: "spend",
            source: "contract_escrow",
            description: `Automated funding upon hire for contract: ${contract.title}`,
            metadata: { 
              contractId: contract._id, 
              milestoneIds: autoFundMilestones.map(m => m._id) 
            }
          });
          
          emitContractUpdate(req, contract, "funded", `System automatically funded ${autoFundMilestones.length} initial milestone(s) totaling ${totalToFund} TKNS`);
        } else {
          logger.error(`[acceptOffer] FUNDING FAILED: Insufficient balance for patron ${contract.patron}`);
          // Rollback hired state if funding was mandatory but failed? 
          // For now, we'll just log it. The user will see it's unfunded.
        }
      }
    }

    if (job.status === "open") job.status = "in_progress";

    await contract.save();
    await job.save();

    logger.info(`[acceptOffer] Success. Contract: ${contract._id}`);

    res.status(200).json({ 
      success: true, 
      message: "Agreement signed and hired successfully!",
      data: { contractId: contract._id } 
    });
  } catch (error) {
    logger.error("Accept Offer Error:", error);
    res.status(500).json({ success: false, message: "Failed to accept offer" });
  }
};
