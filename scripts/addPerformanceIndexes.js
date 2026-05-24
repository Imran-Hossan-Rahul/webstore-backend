import mongoose from "mongoose";
import dotenv from "dotenv";
import Job from "../models/Job.model.js";
import Contract from "../models/Contract.model.js";
import Message from "../models/Message.model.js";
import Codex from "../models/Codex.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Codalina";

const addIndexes = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for indexing...");

    // 1. Job Indexes
    console.log("Adding Job indexes...");
    await Job.collection.createIndex({ "applicants.user": 1 });
    console.log("Job indexes added.");

    // 2. Contract Indexes
    console.log("Adding Contract indexes...");
    await Contract.collection.createIndex({ craftsman: 1, job: 1, status: 1 });
    console.log("Contract indexes added.");

    // 3. Message Indexes
    console.log("Adding Message indexes...");
    await Message.collection.createIndex({ chatId: 1, sender: 1, readBy: 1 });
    console.log("Message indexes added.");

    // 4. Codex Indexes
    console.log("Adding Codex indexes...");
    await Codex.collection.createIndex({ "impressionHistory.date": 1 });
    console.log("Codex indexes added.");

    console.log("All performance indexes successfully created.");
    process.exit(0);
  } catch (error) {
    console.error("Indexing failed:", error);
    process.exit(1);
  }
};

addIndexes();

