import mongoose from "mongoose";
import Codex from "../models/Codex.model.js";
import dotenv from "dotenv";

dotenv.config();

// Old to new shape mapping
const SHAPE_MIGRATION_MAP = {
  "small": "square-small",
  "medium": "square-medium",
  "large": "square-medium",
  "wide": "rectangle-horizontal",
  "tall": "rectangle-vertical"
};

async function migrateCardShapes() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all codex with old cardShape values
    const oldShapes = Object.keys(SHAPE_MIGRATION_MAP);
    const codexToUpdate = await Codex.find({
      cardShape: { $in: oldShapes }
    });

    console.log(`📊 Found ${codexToUpdate.length} codex to migrate`);

    let updated = 0;
    for (const codex of codexToUpdate) {
      const oldShape = codex.cardShape;
      const newShape = SHAPE_MIGRATION_MAP[oldShape];
      
      if (newShape) {
        codex.cardShape = newShape;
        await codex.save({ validateBeforeSave: false });
        console.log(`✅ Updated codex "${codex.title}" from "${oldShape}" to "${newShape}"`);
        updated++;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} codex`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateCardShapes();


