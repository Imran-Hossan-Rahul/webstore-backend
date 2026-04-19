import mongoose from "mongoose";
import ButtonTemplate from "../models/Template.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

mongoose.connect(MONGODB_CONNECTION_STRING)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

async function checkViewHistory() {
  try {
    const template = await ButtonTemplate.findOne().select('title viewsCount viewHistory');
    
    if (!template) {
      console.log("❌ No templates found");
      process.exit(1);
    }

    console.log(`\n📋 Template: ${template.title}`);
    console.log(`📊 ViewsCount: ${template.viewsCount}`);
    console.log(`📅 ViewHistory entries: ${template.viewHistory?.length || 0}`);
    
    if (template.viewHistory && template.viewHistory.length > 0) {
      console.log(`\n📈 ViewHistory data:`);
      template.viewHistory.forEach(entry => {
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
