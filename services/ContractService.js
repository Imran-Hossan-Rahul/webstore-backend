import mongoose from "mongoose"; // ✅ OPTIMIZATION: Import mongoose for transactions
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";
import Transaction from "../models/Transaction.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import Job from "../models/Job.model.js";
import logger from "../utils/logger.js";
import { parseAmount } from "../utils/amountParser.js";
import cloudinary from "./cloudinary.js";
import fs from "fs";

/**
 * 💼 CONTRACT SERVICE
 * 
 * Handles core business logic for contracts, milestones, and escrow.
 * Decoupled from controllers for better testability and reuse.
 */
class ContractService {
    /**
     * Emit real-time update and log activity
     */
    static async logActivity(req, contract, type, message) {
        const io = req.app.get("io");
        
        contract.activities.push({
            type,
            actor: req.user._id,
            message,
            timestamp: new Date()
        });

        contract.markModified('activities');
        const patronId = contract.patron._id || contract.patron;
        const craftsmanId = contract.craftsman._id || contract.craftsman;

        if (io) {
            io.to(patronId.toString()).emit("contract:update", { contractId: contract._id, type, message });
            io.to(craftsmanId.toString()).emit("contract:update", { contractId: contract._id, type, message });
        }
        
        return contract.save();
    }

    /**
     * Handle milestone work submission
     */
    static async submitWork(contractId, milestoneId, userId, submissionData, files = null) {
        const contract = await Contract.findById(contractId);
        if (!contract || contract.craftsman.toString() !== userId.toString()) {
            throw new Error("Unauthorized or contract not found");
        }

        if (contract.status === "disputed") {
            throw new Error("Contract is in dispute. Actions are locked.");
        }

        const milestone = contract.milestones.id(milestoneId);
        if (!milestone) throw new Error("Milestone not found");
        
        if (!milestone.isFunded) {
            throw new Error("Cannot submit work for unfunded milestone.");
        }

        // Handle File Uploads (Screenshots & Resources)
        let screenshots = [];
        let resources = submissionData.resources || [];
        
        if (files) {
            if (files.screenshots) {
                for (const file of files.screenshots) {
                    const result = await cloudinary.uploader.upload(file.path, { folder: "contracts/submissions/screenshots" });
                    screenshots.push(result.secure_url);
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
            // ... additional resource file logic ...
        }

        const payload = {
            user: userId,
            ...submissionData,
            screenshots,
            submittedAt: new Date()
        };

        if (milestone.status === "submitted" && milestone.submissions.length > 0) {
            milestone.submissions[milestone.submissions.length - 1].set(payload);
        } else {
            milestone.submissions.push(payload);
        }

        milestone.status = "submitted";
        if (milestone.holdStatus === "disputed") milestone.holdStatus = "none";
        
        contract.lastActionAt = new Date();
        return contract;
    }

    /**
     * Fund a contract/milestone from user wallet
     */
    static async fundEscrow(contractId, userId, amount, milestoneIds) {
        const numAmount = Number(amount);
        
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const contract = await Contract.findById(contractId).session(session);
            
            if (!contract || contract.patron.toString() !== userId.toString()) {
                throw new Error("Unauthorized or contract not found");
            }

            // Atomic Balance Check & Deduction within transaction
            const patron = await User.findOneAndUpdate(
                { _id: userId, walletBalance: { $gte: numAmount } },
                { $inc: { walletBalance: -numAmount } },
                { new: true, session }
            );

            if (!patron) {
                throw new Error(`Insufficient wallet balance. Need ${numAmount} TKNS.`);
            }

            // Update Escrow
            contract.escrowBalance += numAmount;
            
            if (milestoneIds && milestoneIds.length > 0) {
                milestoneIds.forEach(mId => {
                    const milestone = contract.milestones.id(mId);
                    if (milestone && !milestone.isFunded) {
                        milestone.isFunded = true;
                        milestone.amountFunded = parseAmount(milestone.amount);
                        milestone.status = "funded";
                    }
                });
            }

            const totalFunded = contract.milestones.reduce((sum, m) => sum + (m.amountFunded || 0), 0);
            const totalAgreed = parseAmount(contract.agreedBudget);

            contract.paymentStatus = totalFunded >= totalAgreed ? "fully_funded" : "partially_funded";
            contract.lastActionAt = new Date();

            await contract.save({ session });

            // Log Transactions
            await Transaction.create([{
                contract: contract._id,
                fromUser: userId,
                amount: numAmount,
                type: "deposit",
                status: "completed",
                paymentGateway: "token_internal",
                metadata: { milestoneIds }
            }], { session });

            await TokenTransaction.create([{
                user: userId,
                amount: numAmount,
                type: "spend",
                source: "contract_escrow",
                description: `Funded escrow for contract: ${contract.title}`,
                metadata: { contractId: contract._id }
            }], { session });

            await session.commitTransaction();
            session.endSession();

            return contract;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}

export default ContractService;
