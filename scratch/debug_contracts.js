import mongoose from "mongoose";
import dotenv from "dotenv";
import Contract from "../models/Contract.model.js";
import User from "../models/User.model.js";
import Job from "../models/Job.model.js";

dotenv.config();

async function debugContracts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const email = process.argv[2] || "noo@gmail.com";
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("❌ User not found");
      process.exit(1);
    }

    console.log(`👤 User: ${user.name} (${user.email}) | ID: ${user._id} | Role: ${user.role}`);

    const asCraftsman = await Contract.find({ craftsman: user._id })
      .populate("job", "title")
      .populate("patron", "name")
      .populate("craftsman", "name");
    const asPatron = await Contract.find({ patron: user._id })
      .populate("job", "title")
      .populate("patron", "name")
      .populate("craftsman", "name");

    console.log(`\n💼 AS CRAFTSMAN (${asCraftsman.length}):`);
    asCraftsman.forEach(c => {
      console.log(`- [${c.status}] Title: "${c.title}" | JobTitle: "${c.job?.title}" (ID: ${c._id})`);
    });

    console.log(`\n🏢 AS PATRON (${asPatron.length}):`);
    asPatron.forEach(c => {
      console.log(`- [${c.status}] ${c.title} (ID: ${c._id})`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugContracts();
