import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);

export default AuditLog;
