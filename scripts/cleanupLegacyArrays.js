// backend/scripts/cleanupLegacyArrays.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/webstore";

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("🚀 Connected to MongoDB for cleanup");

    // Artifact Cleanup
    console.log("🧹 Cleaning up Artifact documents...");
    const artResult = await mongoose.connection.db.collection("artifacts").updateMany(
      {},
      { 
        $unset: { 
          viewHistory: "", 
          downloadHistory: "", 
          shareHistory: "", 
          impressionHistory: "", 
          auditLogs: "",
          likeHistory: ""
        } 
      }
    );
    console.log(`✅ Cleaned ${artResult.modifiedCount} artifacts`);

    // Codex Cleanup
    console.log("🧹 Cleaning up Codex documents...");
    const codexResult = await mongoose.connection.db.collection("codexes").updateMany(
      {},
      { 
        $unset: { 
          viewHistory: "", 
          impressionHistory: "", 
          likeHistory: "", 
          shareHistory: "" 
        } 
      }
    );
    console.log(`✅ Cleaned ${codexResult.modifiedCount} codexes`);

    // User Cleanup
    console.log("🧹 Cleaning up User documents...");
    const userResult = await mongoose.connection.db.collection("users").updateMany(
      {},
      { 
        $unset: { 
          auditLogs: "", 
          followers: "", 
          following: "", 
          sessions: "" 
        } 
      }
    );
    console.log(`✅ Cleaned ${userResult.modifiedCount} users`);

    console.log("🏁 Cleanup completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
}

cleanup();
