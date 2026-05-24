import Contract from "../models/Contract.model.js";
import TimeLog from "../models/TimeLog.model.js";
import Transaction from "../models/Transaction.model.js";
import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import Job from "../models/Job.model.js";
import logger from "../utils/logger.js";

import { parseAmount } from "../utils/amountParser.js";
import ContractService from "../services/ContractService.js";
import cloudinary from "../services/cloudinary.js";
import fs from "fs";

// Helper for real-time updates and activity logging
const emitContractUpdate = (req, contract, type, message) => {
  const io = req.app.get("io");
  
  // Log activity
  contract.activities.push({
    type,
    actor: req.user._id,
    message,
    timestamp: new Date()
  });

  // Ensure activities are saved
  contract.markModified('activities');

  // Emit real-time event to both parties
  const patronId = contract.patron._id || contract.patron;
  const craftsmanId = contract.craftsman._id || contract.craftsman;

  io.to(patronId.toString()).emit("contract:update", { contractId: contract._id, type, message });
  io.to(craftsmanId.toString()).emit("contract:update", { contractId: contract._id, type, message });
};

export const getContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate("patron", "name profilePicture email")
      .populate("craftsman", "name profilePicture email")
      .populate("job", "title description category");
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });
    if (contract.patron._id.toString() !== req.user._id.toString() && 
        contract.craftsman._id.toString() !== req.user._id.toString() && 
        req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Check if current user has already left a review
    const Review = (await import("../models/Review.model.js")).default;
    const hasReviewed = await Review.exists({
      contract: contract._id,
      reviewer: req.user._id
    });

    res.status(200).json({ 
      success: true, 
      data: {
        ...contract.toObject(),
        hasReviewed: !!hasReviewed
      }
    });
  } catch (error) {
    console.error("Fetch Contract Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch contract" });
  }
};

export const uploadSubmissionFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const fileUrl = `/${req.file.path.replace(/\\/g, "/")}`;
    
    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        name: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype,
        thumbnail: req.file.mimetype.startsWith("image/") ? fileUrl : null
      }
    });
  } catch (error) {
    console.error("Submission Upload Error:", error);
    res.status(500).json({ success: false, message: "File upload failed" });
  }
};

export const getMyContracts = async (req, res) => {
  try {
    const query = {
      $or: [
        { patron: req.user._id },
        { craftsman: req.user._id }
      ],
      status: { $ne: "pending" }
    };
    const contracts = await Contract.find(query)
      .populate("patron", "name profilePicture")
      .populate("craftsman", "name profilePicture")
      .populate("job", "title")
      .sort("-createdAt");
    res.status(200).json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch contracts" });
  }
};

export const submitMilestoneWork = async (req, res) => {
  try {
    const { id: contractId, milestoneId } = req.params;
    const contract = await ContractService.submitWork(
        contractId, 
        milestoneId, 
        req.user._id, 
        req.body, 
        req.files
    );

    await ContractService.logActivity(
        req, 
        contract, 
        "submitted", 
        `${req.user.name} submitted work for milestone.`
    );

    res.status(200).json({ success: true, message: "Work submitted", data: contract });
  } catch (error) {
    console.error("Submission Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to submit work" });
  }
};

export const approveMilestone = async (req, res) => {
  try {
    const { id: contractId, milestoneId } = req.params;
    const contract = await Contract.findById(contractId).populate("craftsman");
    if (!contract || contract.patron.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // If contract is disputed, patron can still approve to RESOLVE the dispute
    // (We removed the hard lock here to allow self-resolution)

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });
    
    if (milestone.status === "paid") {
      return res.status(400).json({ success: false, message: "Milestone is already paid" });
    }
    
    if (!milestone.isFunded) return res.status(400).json({ success: false, message: "Milestone not funded" });

    // 🚀 Step 1: Set to Holding Period (3 Days)
    milestone.status = "holding";
    milestone.holdStatus = "holding";
    milestone.approvedAt = new Date();
    
    // 🚀 Auto-resolve contract dispute if this was the only disputed milestone
    const otherDisputes = contract.milestones.some(m => 
      (m.status === "disputed" || m.holdStatus === "disputed") && 
      m._id.toString() !== milestoneId
    );
    
    if (!otherDisputes) {
      console.log(`[Approve] No other disputes found. Reverting contract ${contract._id} to active.`);
      contract.status = "active";
    }

    // Schedule release for 3 days from now
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + 3);
    milestone.releaseScheduledAt = releaseDate;

    // Explicitly mark milestones as modified for Mongoose
    contract.markModified('milestones');
    contract.lastActionAt = new Date();
    
    emitContractUpdate(req, contract, "approved", `${req.user.name} approved the work for: "${milestone.title}". Hold period started.`);

    // 🚀 Step 2: Auto-Fund Next Milestone if applicable
    const milestoneIndex = contract.milestones.findIndex(m => m._id.toString() === milestoneId);
    const nextMilestone = contract.milestones[milestoneIndex + 1];

    if (nextMilestone && nextMilestone.isAutoFunded && !nextMilestone.isFunded) {
      const autoAmount = parseAmount(nextMilestone.amount);
      if (autoAmount > 0) {
        // Attempt to deduct from patron wallet
        const patron = await User.findOneAndUpdate(
          { _id: contract.patron, walletBalance: { $gte: autoAmount } },
          { $inc: { walletBalance: -autoAmount } },
          { new: true }
        );

        if (patron) {
          nextMilestone.isFunded = true;
          nextMilestone.amountFunded = autoAmount;
          nextMilestone.status = "funded";
          contract.escrowBalance += autoAmount;
          
          // Log funding transaction
          await Transaction.create({
            contract: contract._id,
            fromUser: contract.patron,
            amount: autoAmount,
            type: "deposit",
            status: "completed",
            paymentGateway: "token_internal",
            gatewayTransactionId: `AUTO-${Date.now()}`,
            metadata: { milestoneId: nextMilestone._id, autoFunded: true }
          });

          await TokenTransaction.create({
            user: contract.patron,
            amount: autoAmount,
            type: "spend",
            source: "contract_escrow",
            description: `Auto-funded milestone: ${nextMilestone.title}`,
            metadata: { contractId: contract._id, milestoneId: nextMilestone._id }
          });

          emitContractUpdate(req, contract, "funded", `System automatically funded next milestone: "${nextMilestone.title}" (${autoAmount} TKNS)`);
        } else {
          emitContractUpdate(req, contract, "alert", `Automatic funding for next milestone failed: Insufficient wallet balance.`);
        }
      }
    }

    await contract.save();

    res.status(200).json({ 
      success: true, 
      message: "Work approved. Next milestone auto-funded if applicable.", 
      data: contract 
    });
  } catch (error) {
    logger.error("Approve Milestone Error:", error);
    res.status(500).json({ success: false, message: "Failed to approve work" });
  }
};

export const releaseMilestone = async (req, res) => {
  try {
    const { id: contractId, milestoneId } = req.params;
    // Only Admin or a System process can trigger this normally, but for now let's allow Admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only administrators can manually release funds during hold." });
    }

    const contract = await Contract.findById(contractId).populate("craftsman");
    const milestone = contract.milestones.id(milestoneId);
    
    if (!milestone || milestone.status !== "holding") {
      return res.status(400).json({ success: false, message: "Milestone is not in holding state" });
    }

    const grossAmount = parseAmount(milestone.amount);
    const commissionRate = (contract.platformFeeRate || 10) / 100;
    const platformFee = grossAmount * commissionRate;
    const payAmount = grossAmount - platformFee;

    // 1. Deduct from Escrow
    contract.escrowBalance -= grossAmount;
    milestone.status = "paid";
    milestone.holdStatus = "released";
    milestone.releasedAt = new Date();
    
    emitContractUpdate(req, contract, "paid", `Funds for milestone "${milestone.title}" have been released to the craftsman.`);

    await contract.save();

    // 2. Transfer to Craftsman Wallet
    const craftsman = await User.findById(contract.craftsman._id);
    const previousBalance = craftsman.walletBalance;
    craftsman.walletBalance += payAmount;
    craftsman.totalEarnings = (craftsman.totalEarnings || 0) + payAmount;
    await craftsman.save();

    // 3. Log Transaction
    await TokenTransaction.create({
      user: craftsman._id,
      amount: payAmount,
      type: "reward",
      source: "contract_payment",
      description: `Final release for milestone: ${milestone.title} (Contract: ${contract.title})`,
      isVerifiedExperience: true,
      metadata: { contractId, milestoneId, previousBalance, newBalance: craftsman.walletBalance }
    });

    res.status(200).json({ success: true, message: "Funds released to craftsman successfully", data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to release funds" });
  }
};

export const closeContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    // Only patron can close the contract (standard practice)
    if (contract.patron.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only the patron or admin can close the contract" });
    }

    if (contract.status === "disputed") {
      return res.status(403).json({ success: false, message: "Cannot close a contract while it is in dispute." });
    }

    if (contract.status === "completed") {
      return res.status(400).json({ success: false, message: "Contract is already completed" });
    }

    // Check if there are any unfunded or unpaid milestones
    const hasActiveMilestones = contract.milestones.some(m => !["paid", "cancelled"].includes(m.status));
    if (hasActiveMilestones) {
      return res.status(400).json({ success: false, message: "Cannot close contract with active or unpaid milestones" });
    }

    contract.status = "completed";
    contract.lastActionAt = new Date();

    emitContractUpdate(req, contract, "completed", `Contract "${contract.title}" has been marked as completed. You can now leave a review.`);

    await contract.save();

    res.status(200).json({ success: true, message: "Contract completed successfully", data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to close contract" });
  }
};

export const disputeMilestone = async (req, res) => {
  try {
    const { id: contractId, milestoneId } = req.params;
    const { reason } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract || contract.patron.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone || milestone.status !== "holding") {
      return res.status(400).json({ success: false, message: "Can only dispute milestones during the 3-day hold period." });
    }

    milestone.status = "disputed";
    milestone.holdStatus = "disputed";
    contract.status = "disputed"; // Put entire contract in dispute
    contract.lastActionAt = new Date();
    
    emitContractUpdate(req, contract, "disputed", `${req.user.name} raised a formal dispute for milestone: ${milestone.title}`);

    await contract.save();

    // Logic for notifying admin would go here
    
    res.status(200).json({ success: true, message: "Milestone flagged for dispute. Admin will review the case.", data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to flag dispute" });
  }
};


export const acceptAgreement = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    if (contract.patron.toString() === req.user._id.toString()) {
      contract.patronAccepted = true;
    } else if (contract.craftsman.toString() === req.user._id.toString()) {
      contract.craftsmanAccepted = true;
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (contract.patronAccepted && contract.craftsmanAccepted) {
      logger.info(`[acceptAgreement] Contract ${contract._id} fully accepted. Activating...`);
      contract.status = "active";
      
      // 🚀 Step 1: Move Applicant to 'hired' stage
      if (contract.job && contract.craftsman) {
        await Job.updateOne(
          { _id: contract.job, "applicants.user": contract.craftsman },
          { 
            $set: { "applicants.$.stage": "hired" },
            $push: { 
              "applicants.$.stageHistory": { 
                stage: "hired", 
                note: "Agreement fully signed by both parties." 
              } 
            }
          }
        );
      }

      // 🚀 Step 2: Automated Escrow Funding for Initial Milestones
      const autoFundMilestones = contract.milestones.filter(m => 
        (m.isInitial || m.isAutoFunded) && !m.isFunded
      );

      logger.info(`[acceptAgreement] Targets for auto-fund: ${autoFundMilestones.length}`);

      if (autoFundMilestones.length > 0) {
        let totalToFund = 0;
        autoFundMilestones.forEach(m => {
          totalToFund += parseAmount(m.amount);
        });

        logger.info(`[acceptAgreement] Total to fund: ${totalToFund}`);

        if (totalToFund > 0) {
          const patron = await User.findOneAndUpdate(
            { _id: contract.patron, walletBalance: { $gte: totalToFund } },
            { $inc: { walletBalance: -totalToFund } },
            { new: true }
          );

          if (patron) {
            logger.info(`[acceptAgreement] Wallet deduction success. New balance: ${patron.walletBalance}`);
            // Update milestones and contract
            autoFundMilestones.forEach(m => {
              m.isFunded = true;
              m.amountFunded = parseAmount(m.amount);
              m.status = "funded";
            });

            contract.escrowBalance += totalToFund;
            
            // Log funding transactions
            await Transaction.create({
              contract: contract._id,
              fromUser: contract.patron,
              amount: totalToFund,
              type: "deposit",
              status: "completed",
              paymentGateway: "token_internal",
              gatewayTransactionId: `AUTO-INIT-${Date.now()}`,
              metadata: { 
                milestoneIds: autoFundMilestones.map(m => m._id),
                autoFunded: true,
                trigger: "agreement_acceptance"
              }
            });

            await TokenTransaction.create({
              user: contract.patron,
              amount: totalToFund,
              type: "spend",
              source: "contract_escrow",
              description: `Automated Escrow Funding: ${contract.title}`,
              metadata: {
                contractId: contract._id,
                totalFunded: totalToFund,
                previousBalance: patron.walletBalance + totalToFund,
                newBalance: patron.walletBalance
              }
            });

            emitContractUpdate(req, contract, "funded", `System automatically funded ${autoFundMilestones.length} initial milestone(s) totaling ${totalToFund} TKNS`);
          } else {
            logger.error(`[acceptAgreement] FUNDING FAILED: Insufficient balance for patron ${contract.patron}`);
            // ❌ ROLLBACK: Do not activate contract if funding fails
            contract.patronAccepted = false; // Reset so they have to try again or fund manually
            contract.craftsmanAccepted = false;
            return res.status(400).json({ 
              success: false, 
              message: "Automated funding failed: Insufficient wallet balance. Please add tokens and try again." 
            });
          }
        }
      }
    }

    contract.lastActionAt = new Date();
    
    emitContractUpdate(req, contract, "accepted", `${req.user.name} signed the bilateral agreement`);

    await contract.save();
    res.status(200).json({ success: true, message: "Agreement accepted", data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to accept agreement" });
  }
};

export const declineOffer = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    // Only craftsman can decline the initial offer
    if (contract.craftsman.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the assigned craftsman can decline this offer" });
    }

    if (contract.status !== "pending") {
      return res.status(400).json({ success: false, message: "Can only decline pending offers" });
    }

    contract.status = "cancelled";
    contract.lastActionAt = new Date();

    emitContractUpdate(req, contract, "declined", `${req.user.name} declined the contract offer.`);

    // Update job application status
    if (contract.job && contract.craftsman) {
      await Job.updateOne(
        { _id: contract.job, "applicants.user": contract.craftsman },
        { 
          $set: { "applicants.$.stage": "rejected" },
          $push: { 
            "applicants.$.stageHistory": { 
              stage: "rejected", 
              note: "Craftsman declined the contract offer." 
            } 
          }
        }
      );
    }

    await contract.save();
    res.status(200).json({ success: true, message: "Offer declined successfully", data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to decline offer" });
  }
};

// ── TIME TRACKING (UPWORK STYLE) ──

export const startTimer = async (req, res) => {
  try {
    // 🔒 BUG FIX: `contract` was never fetched — caused ReferenceError crash on every call
    const contract = await Contract.findById(req.params.id);
    if (!contract || contract.craftsman.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // 🛡️ Security Gate: Cannot track time for unfunded contracts
    if (contract.paymentStatus === "unfunded") {
      return res.status(403).json({ success: false, message: "Timer cannot be started until at least one milestone is funded by the patron." });
    }

    const activeTimer = await TimeLog.findOne({ contract: contract._id, craftsman: req.user._id, status: "active" });
    if (activeTimer) return res.status(400).json({ success: false, message: "Timer already running" });

    const timeLog = await TimeLog.create({
      contract: contract._id,
      craftsman: req.user._id,
      startTime: new Date(),
      memo: req.body.memo || "Working on devlog",
      segments: []
    });

    emitContractUpdate(req, contract, "timer_started", `${req.user.name} started the session timer: ${timeLog.memo}`);
    await contract.save();

    res.status(201).json({ success: true, data: timeLog });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to start timer" });
  }
};

export const stopTimer = async (req, res) => {
  try {
    const timeLog = await TimeLog.findOne({ _id: req.params.logId, craftsman: req.user._id, status: "active" });
    if (!timeLog) return res.status(404).json({ success: false, message: "No active session" });

    timeLog.endTime = new Date();
    timeLog.status = "completed";
    const diffMs = timeLog.endTime - timeLog.startTime;
    timeLog.duration = Math.round(diffMs / 60000);
    
    await timeLog.save();

    // Log to contract activities
    const contract = await Contract.findById(timeLog.contract);
    if (contract) {
      emitContractUpdate(req, contract, "timer_stopped", `${req.user.name} completed a work session (${timeLog.duration} mins)`);
      await contract.save();
    }

    res.status(200).json({ success: true, data: timeLog });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to stop timer" });
  }
};

export const addTimeSnapshot = async (req, res) => {
  try {
    const { activityLevel, screenshots, keyboardCount, mouseCount, activeWindow } = req.body;
    const timeLog = await TimeLog.findOne({ _id: req.params.logId, craftsman: req.user._id, status: "active" });
    
    if (!timeLog) return res.status(404).json({ success: false, message: "Active session not found" });

    timeLog.segments.push({
      timeSlot: new Date(),
      activityLevel: activityLevel || 0,
      screenshots: screenshots || [],
      keyboardCount: keyboardCount || 0,
      mouseCount: mouseCount || 0,
      activeWindow: activeWindow || "System Workspace",
      capturedAt: new Date()
    });

    await timeLog.save();
    res.status(200).json({ success: true, message: "Snapshot captured" });
  } catch (error) {
    logger.error("Add Snapshot Error:", error);
    res.status(500).json({ success: false, message: "Failed to capture snapshot" });
  }
};

export const getTimeLogs = async (req, res) => {
  try {
    const logs = await TimeLog.find({ contract: req.params.id }).sort("-startTime");
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
};

export const fundContract = async (req, res) => {
  try {
    const { amount, milestoneIds } = req.body;
    const contract = await ContractService.fundEscrow(
        req.params.id, 
        req.user._id, 
        amount, 
        milestoneIds
    );

    await ContractService.logActivity(
        req, 
        contract, 
        "funded", 
        `Escrow Funded: ${req.user.name} deposited ${amount} TKNS`
    );

    res.status(200).json({ success: true, message: "Escrow funded successfully", data: contract });

    // 3. Audit log
    await TokenTransaction.create({
      user: req.user._id,
      amount: numAmount,
      type: "spend",
      source: "contract_escrow",
      description: `Funded escrow for contract: ${contract.title}`,
      metadata: {
        contractId: contract._id,
        milestoneIds,
        previousBalance: deductedUser.walletBalance + numAmount, // before deduction
        newBalance: deductedUser.walletBalance
      }
    });

    res.status(200).json({ 
      success: true, 
      message: "Funds successfully moved from wallet to escrow",
      data: {
        walletBalance: deductedUser.walletBalance,
        escrowBalance: contract.escrowBalance,
        transactionId: transaction.gatewayTransactionId,
        paymentStatus: contract.paymentStatus
      }
    });
  } catch (error) {
    logger.error("CRITICAL FUNDING ERROR:", error);
    res.status(500).json({ success: false, message: "Payment processing failed" });
  }
};

export const createContract = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      budgetType, 
      agreedBudget, 
      milestones, 
      craftsmanId, 
      jobId, 
      legalTerms 
    } = req.body;

    const contract = await Contract.create({
      patron: req.user._id,
      craftsman: craftsmanId,
      job: jobId,
      title,
      description,
      budgetType: budgetType || "fixed",
      agreedBudget,
      milestones: (milestones || []).map(m => ({
        ...m,
        status: "pending",
        isAutoFunded: !!m.isAutoFunded,
        isInitial: !!m.isInitial,
        isAutoBalance: !!m.isAutoBalance
      })),
      legalTerms: legalTerms || {},
      status: "pending",
      patronAccepted: true,
      craftsmanAccepted: false
    });

    // 🚀 Update Applicant Status in Job Model
    if (jobId && craftsmanId) {
      await Job.updateOne(
        { _id: jobId, "applicants.user": craftsmanId },
        { 
          $set: { "applicants.$.stage": "offer_sent", "applicants.$.offer": contract._id },
          $push: { 
            "applicants.$.stageHistory": { 
              stage: "offer_sent", 
              note: "Contract offer extended to talent." 
            } 
          }
        }
      );
    }

    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    logger.error("Create Contract Error:", error);
    res.status(500).json({ success: false, message: "Failed to create contract" });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { title, description, budgetType, agreedBudget, milestones } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.patron.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (contract.status !== "pending") {
      return res.status(400).json({ success: false, message: "Cannot edit offer after it has been accepted or active." });
    }

    contract.title = title || contract.title;
    contract.description = description || contract.description;
    contract.budgetType = budgetType || contract.budgetType;
    contract.agreedBudget = agreedBudget || contract.agreedBudget;
    contract.milestones = (milestones || []).map(m => ({ 
      ...m, 
      status: "pending",
      isAutoFunded: !!m.isAutoFunded 
    }));
    
    contract.isRevised = true;
    contract.revisionCount += 1;
    contract.craftsmanAccepted = false; // Reset craftsman acceptance if edited
    contract.lastActionAt = new Date();

    emitContractUpdate(req, contract, "revised", `${req.user.name} revised the contract offer terms.`);

    await contract.save();
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    logger.error("Update Offer Error:", error);
    res.status(500).json({ success: false, message: "Failed to update offer" });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { id: contractId, milestoneId } = req.params;
    const { resolution, message } = req.body; // resolution: 'release' or 'refund'

    if (req.user.role !== "admin" && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized: Admin only" });
    }

    const contract = await Contract.findById(contractId).populate("craftsman patron");
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone || milestone.status !== "disputed") {
      return res.status(400).json({ success: false, message: "Milestone is not in dispute" });
    }

    const grossAmount = parseAmount(milestone.amount);

    if (resolution === "release") {
      // 🚀 ADMIN OVERRIDE: Release funds to craftsman
      const commissionRate = (contract.platformFeeRate || 10) / 100;
      const platformFee = grossAmount * commissionRate;
      const payAmount = grossAmount - platformFee;

      contract.escrowBalance -= grossAmount;
      milestone.status = "paid";
      milestone.holdStatus = "released";
      milestone.releasedAt = new Date();

      const craftsman = await User.findById(contract.craftsman._id);
      craftsman.walletBalance += payAmount;
      craftsman.totalEarnings = (craftsman.totalEarnings || 0) + payAmount;
      await craftsman.save();

      await TokenTransaction.create({
        user: craftsman._id,
        amount: payAmount,
        type: "reward",
        source: "contract_payment",
        description: `Admin Resolution: Funds released for milestone "${milestone.title}" after dispute.`,
        isVerifiedExperience: true,
        metadata: { contractId, milestoneId, adminResolution: true }
      });

      emitContractUpdate(req, contract, "paid", `Admin resolved dispute: Funds released to craftsman for "${milestone.title}". Note: ${message}`);

    } else if (resolution === "refund") {
      // 🚀 ADMIN OVERRIDE: Refund funds to patron
      contract.escrowBalance -= grossAmount;
      milestone.status = "cancelled";
      milestone.holdStatus = "none";
      milestone.isFunded = false;
      milestone.amountFunded = 0;

      const patron = await User.findById(contract.patron._id);
      patron.walletBalance += grossAmount;
      await patron.save();

      await TokenTransaction.create({
        user: patron._id,
        amount: grossAmount,
        type: "reward", // Refund is treated as a reward/top-up
        source: "contract_escrow",
        description: `Admin Resolution: Escrow refund for milestone "${milestone.title}" after dispute.`,
        metadata: { contractId, milestoneId, adminResolution: true, refund: true }
      });

      emitContractUpdate(req, contract, "refunded", `Admin resolved dispute: Funds refunded to patron for "${milestone.title}". Note: ${message}`);
    }

    // Check if there are other disputed milestones
    const otherDisputes = contract.milestones.some(m => m.status === "disputed");
    if (!otherDisputes) {
      contract.status = "active"; // Restore devlog status
    }

    await contract.save();
    res.status(200).json({ success: true, message: `Dispute resolved with ${resolution}`, data: contract });

  } catch (error) {
    logger.error("Resolve Dispute Error:", error);
    res.status(500).json({ success: false, message: "Failed to resolve dispute" });
  }
};

