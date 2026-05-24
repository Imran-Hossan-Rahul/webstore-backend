import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../Codalina-backend/.env") });

const MONGO_URI = process.env.MONGODB_URI;

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;

    // 1. Rename fields in Users collection
    console.log("Migrating Users collection...");
    await db.collection("users").updateMany(
      {},
      {
        $rename: {
          hasCraftsmanAccount: "hasCraftsmanAccount",
          craftsmanProfileId: "craftsmanProfileId",
        },
      }
    );

    // 2. Rename fields in Contracts collection
    console.log("Migrating Contracts collection...");
    await db.collection("contracts").updateMany(
      {},
      {
        $rename: {
          patron: "Patron",
          craftsman: "craftsman",
        },
      }
    );

    // 3. Rename fields in Jobs collection
    console.log("Migrating Jobs collection...");
    await db.collection("jobs").updateMany(
      {},
      {
        $rename: {
          patron: "Patron",
        },
      }
    );

    // 4. Rename fields in Resources collection
    console.log("Migrating Resources collection...");
    await db.collection("resources").updateMany(
      {},
      {
        $rename: {
          craftsman: "craftsman",
        },
      }
    );

    // 5. Rename fields in CommunityTasks collection
    console.log("Migrating CommunityTasks collection...");
    await db.collection("communitytasks").updateMany(
      {},
      {
        $rename: {
          craftsman: "craftsman",
        },
      }
    );
    
    // 6. Update role values in Users collection
    console.log("Updating role values in Users collection...");
    await db.collection("users").updateMany(
      { role: "patron" },
      { $set: { role: "Patron" } }
    );
    await db.collection("users").updateMany(
      { role: "craftsman" },
      { $set: { role: "craftsman" } }
    );
    await db.collection("users").updateMany(
      { role: "craftsman" },
      { $set: { role: "craftsman" } }
    );

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();

