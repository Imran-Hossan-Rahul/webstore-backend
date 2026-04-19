import mongoose from "mongoose";
import ButtonTemplate from "../models/Template.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

mongoose.connect(MONGODB_CONNECTION_STRING)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

async function testViewHistory() {
  try {
    const template = await ButtonTemplate.findOne();
    
    if (!template) {
      console.log("❌ No templates found");
      return;
    }

    console.log(`\n📋 Template: ${template.title}`);
    console.log(`📊 Current viewsCount: ${template.viewsCount}`);
    console.log(`📅 Current viewHistory entries: ${template.viewHistory?.length || 0}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const count = Math.floor(Math.random() * 10) + 5;

      const existing = template.viewHistory?.find(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === date.getTime();
      });

      if (!existing) {
        template.viewHistory = template.viewHistory || [];
        template.viewHistory.push({ date, count });
        console.log(`✅ Added ${count} views for ${date.toISOString().split('T')[0]}`);
      } else {
        console.log(`⚠️ Entry already exists for ${date.toISOString().split('T')[0]}`);
      }
    }

    await template.save({ validateBeforeSave: false });
    
    console.log(`\n✅ Test data added!`);
    console.log(`📊 New viewHistory entries: ${template.viewHistory.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

testViewHistory();
