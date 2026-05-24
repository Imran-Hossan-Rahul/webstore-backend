import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";
import Job from "../models/Job.model.js";

dotenv.config();

async function verifyWorkspaceLogic() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Find a user who is a patron
    const patronUser = await User.findOne({ email: "noo@gmail.com" });
    if (!patronUser) {
      console.log("❌ No patron user found to test with");
      process.exit(1);
    }

    console.log(`👤 Testing with Patron User: ${patronUser.name} (${patronUser.email})`);

    // 2. Check contracts where they are craftsman
    const asCraftsman = await Contract.find({ craftsman: patronUser._id, status: { $ne: "pending" } });
    console.log(`💼 Found ${asCraftsman.length} devlogs where they are HIRED (Craftsman).`);

    // 3. Check contracts where they are patron
    const asPatron = await Contract.find({ patron: patronUser._id, status: { $ne: "pending" } });
    console.log(`🏢 Found ${asPatron.length} devlogs where they are the PATRON.`);

    // 4. Simulate the new query
    const query = {
      $or: [
        { patron: patronUser._id },
        { craftsman: patronUser._id }
      ],
      status: { $ne: "pending" }
    };
    const total = await Contract.countDocuments(query);
    console.log(`\n🚀 NEW LOGIC RESULT: Total devlogs visible in workspace: ${total}`);

    if (total === (asCraftsman.length + asPatron.length)) {
      console.log("✅ SUCCESS: All devlogs (both as patron and craftsman) are now visible!");
    } else {
      console.log("❌ FAILURE: Something is still missing.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verifyWorkspaceLogic();

