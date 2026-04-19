import mongoose from "mongoose";
import ButtonTemplate from "../models/Template.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

mongoose.connect(MONGODB_CONNECTION_STRING)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

async function testAPI() {
  try {
    const templates = await ButtonTemplate.find().select('viewHistory viewsCount title user');
    
    console.log(`\n📊 Found ${templates.length} templates\n`);
    
    const viewsMap = new Map();
    
    templates.forEach(template => {
        console.log(`Template: ${template.title}`);
        console.log(`  ViewsCount: ${template.viewsCount}`);
        console.log(`  History entries: ${template.viewHistory?.length || 0}`);
        
        if (template.viewHistory && template.viewHistory.length > 0) {
            template.viewHistory.forEach(entry => {
                const dateKey = new Date(entry.date).toISOString().split('T')[0];
                const existing = viewsMap.get(dateKey) || 0;
                viewsMap.set(dateKey, existing + (entry.count || 0));
            });
        }
    });
    
    const data = Array.from(viewsMap.entries())
        .map(([date, views]) => ({
            date: new Date(date).toISOString(),
            views
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`\n📈 API Response would be:`);
    console.log(JSON.stringify({ success: true, data }, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

testAPI();
