import Job from "../models/Job.model.js";
import logger from "../utils/logger.js";

/**
 * @desc    Create a new job posting
 * @route   POST /api/v1/jobs
 * @access  Private (Hirer/Client only strictly, but allowed for all for now for testing)
 */
export const createJob = async (req, res) => {
  try {
    const { title, description, category, skills, budget, level, location, deadline } = req.body;

    const job = await Job.create({
      client: req.user._id,
      title,
      description,
      category,
      skills,
      budget,
      level,
      location,
      deadline
    });

    // Populate client for immediate return
    await job.populate("client", "name profilePicture email");

    res.status(201).json({
      success: true,
      data: job
    });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filters
    const query = { status: "open" };
    if (req.query.category) query.category = req.query.category;
    if (req.query.level) query.level = req.query.level;
    if (req.query.type) query["budget.type"] = req.query.type;
    if (req.query.q) {
        query.$or = [
            { title: { $regex: req.query.q, $options: "i" } },
            { description: { $regex: req.query.q, $options: "i" } },
            { skills: { $in: [new RegExp(req.query.q, "i")] } }
        ];
    }

    const jobs = await Job.find(query)
      .populate("client", "name profilePicture email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Job.countDocuments(query);

    // Transform for frontend
    const jobsWithClient = jobs.map(job => ({
        ...job,
        client: {
             _id: job.client._id,
             name: job.client.name,
             avatar: job.client.profilePicture || "", // Add creator fallback if needed here too
             email: job.client.email
        },
        applicantCount: job.applicants ? job.applicants.length : 0
    }));

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobsWithClient,
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
       .populate("client", "name profilePicture email")
       .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Transform
    job.client = {
         _id: job.client._id,
         name: job.client.name,
         avatar: job.client.profilePicture || "",
         email: job.client.email
    };
    job.applicantCount = job.applicants ? job.applicants.length : 0;

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error("Get Job Detail Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * @desc    Apply to a job
 * @route   POST /api/v1/jobs/:id/apply
 * @access  Private
 */
export const applyToJob = async (req, res) => {
    try {
      const jobId = req.params.id;
      const userId = req.user._id;
  
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: "Job not found" });
      }

      if (job.status !== 'open') {
         return res.status(400).json({ success: false, message: "Job is no longer accepting applications" });
      }
  
      // Check if already applied
      const alreadyApplied = job.applicants.find(app => app.user.toString() === userId.toString());
      if (alreadyApplied) {
        return res.status(400).json({ success: false, message: "You have already applied to this job" });
      }
  
      job.applicants.push({ user: userId });
      await job.save();
  
      res.status(200).json({
        success: true,
        message: "Application submitted successfully"
      });
    } catch (error) {
      logger.error("Apply Job Error:", error);
      res.status(500).json({ success: false, message: "Failed to apply" });
    }
  };
