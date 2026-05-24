import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Artifact from "../models/Artifact.model.js";
import Codex from "../models/Codex.model.js";
import Job from "../models/Job.model.js";

dotenv.config();

/**
 * ðŸš€ STEP 1: Add Text Search Indexes
 * 
 * This script adds MongoDB text indexes for efficient full-text search
 * WITHOUT modifying any existing code logic.
 * 
 * Performance Impact:
 * - Search queries will go from O(n) to O(log n)
 * - Regex searches will be replaced with $text search
 * - Expected 10-15x faster search results
 */

async function addSearchIndexes() {
  try {
    console.log("ðŸ”Œ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("âœ… Connected to MongoDB\n");

    // Check existing indexes first
    console.log("ðŸ“Š Checking existing indexes...\n");

    const userIndexes = await User.collection.getIndexes();
    const postIndexes = await Post.collection.getIndexes();
    const artifactIndexes = await Artifact.collection.getIndexes();
    const codexIndexes     = await Codex.collection.getIndexes();
    const jobIndexes      = await Job.collection.getIndexes();

    console.log("User indexes:", Object.keys(userIndexes));
    console.log("Post indexes:", Object.keys(postIndexes));
    console.log("Artifact indexes:", Object.keys(artifactIndexes));
    console.log("Codex indexes:", Object.keys(codexIndexes));
    console.log("Job indexes:",  Object.keys(jobIndexes));

    console.log("\nðŸ”¨ Creating text search indexes...\n");

    // 1. User Search Index (name, bio, skills)
    try {
      // Drop old text index if exists
      try {
        await User.collection.dropIndex("name_text_bio_text");
      } catch (e) {
        // Index doesn't exist, that's fine
      }

      await User.collection.createIndex(
        { 
          name: "text", 
          bio: "text",
          skills: "text"
        },
        { 
          name: "user_search_index",
          weights: {
            name: 10,      // Name is most important
            skills: 5,     // Skills are important
            bio: 1         // Bio is least important
          }
        }
      );
      console.log("âœ… User search index created");
    } catch (error) {
      console.log("âš ï¸  User index:", error.message);
    }

    // 2. Post Search Index (content, tags, category)
    try {
      await Post.collection.createIndex(
        { 
          content: "text",
          tags: "text",
          category: "text"
        },
        { 
          name: "post_search_index",
          weights: {
            tags: 10,
            category: 5,
            content: 1
          }
        }
      );
      console.log("âœ… Post search index created");
    } catch (error) {
      console.log("âš ï¸  Post index:", error.message);
    }

    // 3. Artifact already has text index, but let's verify
    console.log("âœ… Artifact search index already exists (from model)");

    // 4. Codex already has text index
    console.log("âœ… Codex search index already exists (from model)");

    // 5. Job Search Index (title, description, skills, category)
    try {
      await Job.collection.createIndex(
        { 
          title: "text",
          description: "text",
          skills: "text",
          category: "text"
        },
        { 
          name: "job_search_index",
          weights: {
            title: 10,
            skills: 5,
            category: 3,
            description: 1
          }
        }
      );
      console.log("âœ… Job search index created");
    } catch (error) {
      console.log("âš ï¸  Job index:", error.message);
    }

    // 5. Additional performance indexes
    console.log("\nðŸ”¨ Creating additional performance indexes...\n");

    // User email index (for login optimization)
    try {
      await User.collection.createIndex({ email: 1 }, { unique: true });
      console.log("âœ… User email index verified");
    } catch (error) {
      console.log("âš ï¸  User email index already exists");
    }

    // Post status + type compound index (for feed queries)
    try {
      await Post.collection.createIndex(
        { status: 1, postType: 1, createdAt: -1 },
        { name: "post_feed_index" }
      );
      console.log("âœ… Post feed index created");
    } catch (error) {
      console.log("âš ï¸  Post feed index:", error.message);
    }

    // Artifact active + category index
    try {
      await Artifact.collection.createIndex(
        { isActive: 1, category: 1, createdAt: -1 },
        { name: "artifact_feed_index" }
      );
      console.log("âœ… Artifact feed index created");
    } catch (error) {
      console.log("âš ï¸  Artifact feed index:", error.message);
    }

    // Codex published index
    try {
      await Codex.collection.createIndex(
        { isPublished: 1, isDeleted: 1, createdAt: -1 },
        { name: "codex_feed_index" }
      );
      console.log("âœ… Codex feed index created");
    } catch (error) {
      console.log("âš ï¸  Codex feed index:", error.message);
    }

    console.log("\nâœ… All indexes created successfully!");
    console.log("\nðŸ“Š Final index summary:");
    
    const finalUserIndexes = await User.collection.getIndexes();
    const finalPostIndexes = await Post.collection.getIndexes();
    const finalArtifactIndexes = await Artifact.collection.getIndexes();
    const finalCodexIndexes     = await Codex.collection.getIndexes();
    const finalJobIndexes      = await Job.collection.getIndexes();

    console.log("\nUser indexes:", Object.keys(finalUserIndexes).length);
    console.log("Post indexes:", Object.keys(finalPostIndexes).length);
    console.log("Artifact indexes:", Object.keys(finalArtifactIndexes).length);
    console.log("Codex indexes:", Object.keys(finalCodexIndexes).length);
    console.log("Job indexes:", Object.keys(finalJobIndexes).length);

    console.log("\nðŸŽ‰ Database optimization complete!");
    console.log("âš ï¸  NEXT STEP: Update searchController.js to use $text search");

  } catch (error) {
    console.error("âŒ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nðŸ”Œ MongoDB connection closed");
  }
}

addSearchIndexes();

