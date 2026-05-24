import mongoose from "mongoose";
import Artifact from "../models/Artifact.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

mongoose.connect(MONGODB_CONNECTION_STRING)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

async function checkViewHistory() {
  try {
    const artifact = await Artifact.findOne().select('title viewsCount viewHistory');
    
    if (!artifact) {
      console.log("❌ No artifacts found");
      process.exit(1);
    }

    console.log(`\n📋 Artifact: ${artifact.title}`);
    console.log(`📊 ViewsCount: ${artifact.viewsCount}`);
    console.log(`📅 ViewHistory entries: ${artifact.viewHistory?.length || 0}`);
    
    if (artifact.viewHistory && artifact.viewHistory.length > 0) {
      console.log(`\n📈 ViewHistory data:`);
      artifact.viewHistory.forEach(entry => {
        console.log(`  ${entry.date.toISOString().split('T')[0]}: ${entry.count} views`);
      });
    } else {
      console.log(`\n⚠️ No viewHistory data found!`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

checkViewHistory();


