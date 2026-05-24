import "dotenv/config";
import mongoose from "mongoose";

async function checkIndexes() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Codalina";
  console.log("Connecting to:", uri);
  
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");
    
    const collections = ['users', 'posts', 'artifacts', 'codex'];
    for (const col of collections) {
      try {
        const indexes = await mongoose.connection.db.collection(col).indexes();
        console.log(`\n--- Indexes for ${col} ---`);
        console.log(JSON.stringify(indexes, null, 2));
      } catch (err) {
        console.error(`Error fetching indexes for ${col}:`, err.message);
      }
    }
    
  } catch (err) {
    console.error("Connection error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkIndexes();


