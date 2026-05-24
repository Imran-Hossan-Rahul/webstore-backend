import mongoose from "mongoose";
import Artifact from "../models/Artifact.model.js";
import { MONGODB_CONNECTION_STRING } from "../config/index.js";

mongoose.connect(MONGODB_CONNECTION_STRING)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

async function testAPI() {
  try {
    const artifacts = await Artifact.find().select('viewHistory viewsCount title user');
    
    console.log(`\n📊 Found ${artifacts.length} artifacts\n`);
    
    const viewsMap = new Map();
    
    artifacts.forEach(artifact => {
        console.log(`Artifact: ${artifact.title}`);
        console.log(`  ViewsCount: ${artifact.viewsCount}`);
        console.log(`  History entries: ${artifact.viewHistory?.length || 0}`);
        
        if (artifact.viewHistory && artifact.viewHistory.length > 0) {
            artifact.viewHistory.forEach(entry => {
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


