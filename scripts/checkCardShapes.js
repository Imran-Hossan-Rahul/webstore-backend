import mongoose from "mongoose";
import Blog from "../models/blog.model.js";
import dotenv from "dotenv";

dotenv.config();

async function checkCardShapes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const blogs = await Blog.find({}).select('title slug cardShape').lean();
    
    console.log(`📊 Total blogs: ${blogs.length}\n`);
    console.log("Current cardShape values in database:");
    console.log("=====================================");
    
    blogs.forEach((blog, index) => {
      console.log(`${index + 1}. "${blog.title}"`);
      console.log(`   Slug: ${blog.slug}`);
      console.log(`   CardShape: ${blog.cardShape || 'NOT SET'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkCardShapes();
