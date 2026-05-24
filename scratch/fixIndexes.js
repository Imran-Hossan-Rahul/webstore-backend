import "dotenv/config";
import mongoose from "mongoose";

async function fixIndexes() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Codalina";
  console.log("Connecting to:", uri);
  
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");
    
    const indexConfigs = [
      {
        collection: 'users',
        name: 'user_search_index',
        fields: { name: 'text', username: 'text', bio: 'text', skills: 'text' },
        weights: { name: 10, username: 5, bio: 2, skills: 3 }
      },
      {
        collection: 'posts',
        name: 'post_search_index',
        fields: { title: 'text', content: 'text', tags: 'text', "devlogStats.tools": 'text' },
        weights: { title: 10, tags: 5, content: 2, "devlogStats.tools": 3 }
      },
      {
        collection: 'artifacts',
        name: 'artifact_search_index',
        fields: { title: 'text', description: 'text', tags: 'text', tech: 'text' },
        weights: { title: 10, tags: 5, description: 2, tech: 3 }
      },
      {
        collection: 'codex',
        name: 'codex_search_index',
        fields: { title: 'text', content: 'text', tags: 'text', subtitle: 'text' },
        weights: { title: 10, tags: 5, content: 2, subtitle: 3 }
      }
    ];

    for (const config of indexConfigs) {
      console.log(`\nProcessing ${config.collection}...`);
      const col = mongoose.connection.db.collection(config.collection);
      
      // Find and drop existing text indexes
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (idx.textIndexVersion || idx.name.includes('text') || idx.name.includes('search')) {
          console.log(`Dropping index: ${idx.name}`);
          await col.dropIndex(idx.name);
        }
      }
      
      // Create new text index
      console.log(`Creating new text index: ${config.name}`);
      await col.createIndex(config.fields, { 
        name: config.name, 
        weights: config.weights,
        background: true 
      });
      console.log(`✅ Success for ${config.collection}`);
    }
    
    console.log("\n🚀 All indexes updated successfully!");
    
  } catch (err) {
    console.error("❌ Error fixing indexes:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixIndexes();


