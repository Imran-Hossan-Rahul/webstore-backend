
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/codalina";

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for migration...");

    // 1. Update User roles: patron -> patron
    const userResult = await mongoose.connection.collection("users").updateMany(
      { role: "patron" },
      { $set: { role: "patron" } }
    );
    console.log(`Updated ${userResult.modifiedCount} users (patron -> patron)`);

    // 2. Update Post types: devlog -> devlog
    const postResult = await mongoose.connection.collection("posts").updateMany(
      { postType: "devlog" },
      { $set: { postType: "devlog" } }
    );
    console.log(`Updated ${postResult.modifiedCount} posts (devlog -> devlog)`);

    // 3. Rename collection: buttonArtifacts -> buttonArtifacts (if it exists)
    const collections = await mongoose.connection.db.listCollections().toArray();
    const hasArtifacts = collections.some(c => c.name === "buttonartifacts"); // MongoDB lowercases sometimes
    const hasArtifacts = collections.some(c => c.name === "buttonartifacts");

    if (hasArtifacts && !hasArtifacts) {
       await mongoose.connection.db.collection("buttonartifacts").rename("buttonartifacts");
       console.log("Renamed collection buttonartifacts -> buttonartifacts");
    }

    // 4. Rename collection: codexs -> codices
    const hasCodexs = collections.some(c => c.name === "codexs");
    const hasCodex = collections.some(c => c.name === "codices");
    if (hasCodexs && !hasCodex) {
       await mongoose.connection.db.collection("codexs").rename("codices");
       console.log("Renamed collection codexs -> codices");
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
