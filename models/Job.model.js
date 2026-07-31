import mongoose from "mongoose";

const JobSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Job = mongoose.models.Job || mongoose.model("Job", JobSchema);

export default Job;
