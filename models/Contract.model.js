import mongoose from "mongoose";

const ContractSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Contract = mongoose.models.Contract || mongoose.model("Contract", ContractSchema);

export default Contract;
