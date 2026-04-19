import mongoose from "mongoose";
import Blog from "../models/blog.model.js";
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

    // Find all blogs with old cardShape values
    const oldShapes = Object.keys(SHAPE_MIGRATION_MAP);
    const blogsToUpdate = await Blog.find({
      cardShape: { $in: oldShapes }
    });

    console.log(`📊 Found ${blogsToUpdate.length} blogs to migrate`);

    let updated = 0;
    for (const blog of blogsToUpdate) {
      const oldShape = blog.cardShape;
      const newShape = SHAPE_MIGRATION_MAP[oldShape];
      
      if (newShape) {
        blog.cardShape = newShape;
        await blog.save({ validateBeforeSave: false });
        console.log(`✅ Updated blog "${blog.title}" from "${oldShape}" to "${newShape}"`);
        updated++;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updated} blogs`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateCardShapes();
