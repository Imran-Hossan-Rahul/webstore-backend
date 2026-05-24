import TimeLog from "../models/TimeLog.model.js";
import Contract from "../models/Contract.model.js";
import logger from "../utils/logger.js";

/**
 * @desc    Submit daily time log (Craftsman)
 * @route   POST /api/v1/timelogs
 * @access  Private
 */
export const submitTimeLog = async (req, res) => {
  try {
    const { contractId, date, hoursWorked, description } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract || contract.craftsman.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized for this contract" });
    }

    const timeLog = await TimeLog.create({
      contract: contractId,
      craftsman: req.user._id,
      date,
      hoursWorked,
      description
    });

    res.status(201).json({ success: true, data: timeLog });
  } catch (error) {
    logger.error("Submit TimeLog Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get timelogs for a contract
 * @route   GET /api/v1/timelogs/:contractId
 * @access  Private
 */
export const getTimeLogs = async (req, res) => {
  try {
    const { contractId } = req.params;
    const contract = await Contract.findById(contractId);
    
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });

    // Both patron and craftsman can view
    if (contract.craftsman.toString() !== req.user._id.toString() && contract.patron.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const logs = await TimeLog.find({ contract: contractId }).sort({ date: -1 });

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    logger.error("Get TimeLogs Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Approve/Reject timelog (patron)
 * @route   PATCH /api/v1/timelogs/:id/status
 * @access  Private (patron)
 */
export const updateTimeLogStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const log = await TimeLog.findById(req.params.id).populate("contract");

    if (!log || log.contract.patron.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    log.status = status;
    await log.save();

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    logger.error("Update TimeLog Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
