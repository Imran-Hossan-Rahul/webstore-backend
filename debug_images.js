
import mongoose from "mongoose";
import { connectToDatabase } from "./config/db.js";
import Blog from "./models/blog.model.js";
import ButtonTemplate from "./models/Template.model.js";

const checkData = async () => {
    try {
        await connectToDatabase();
        console.log("Connected to DB");

        // 1. Check ALL Blogs
        const blogs = await Blog.find({ isPublished: true }).select('title coverImage').lean();
        
        let urlCount = 0;
        let base64Count = 0;
        let nullCount = 0;
        let hugeExamples = [];

        blogs.forEach(blog => {
            if (!blog.coverImage) {
                nullCount++;
            } else if (blog.coverImage.startsWith("http")) {
                urlCount++;
            } else {
                base64Count++;
                if (hugeExamples.length < 3) {
                    hugeExamples.push({
                        title: blog.title,
                        length: blog.coverImage.length,
                        preview: blog.coverImage.substring(0, 30)
                    });
                }
            }
        });

        console.log("\n--- BLOG STATS ---");
        console.log(`Total Blogs: ${blogs.length}`);
        console.log(`✅ Valid URLs: ${urlCount}`);
        console.log(`❌ Base64/Heavy: ${base64Count}`);
        console.log(`⚠️ No Image: ${nullCount}`);
        
        if (hugeExamples.length > 0) {
            console.log("\n--- PROBLEMATIC BLOGS (Base64) ---");
            hugeExamples.forEach(b => console.log(`- ${b.title} (Length: ${b.length} chars)`));
        }

        // 2. Check a Template
        const template = await ButtonTemplate.findOne({}).lean();
        if (template) {
            console.log("\n--- TEMPLATE DATA ---");
            console.log("Title:", template.title);
            // Check likely image fields
            const img = template.previewFile || template.coverImage || template.image;
            console.log("Image Type:", img ? (img.startsWith("http") ? "URL" : "Base64/Other") : "None");
            console.log("Image Preview:", img ? img.substring(0, 50) + "..." : "N/A");
             // Check if it has coverImage field too
            if (template.coverImage) {
                 console.log("Template CoverImage:", template.coverImage.substring(0, 50));
            }
        } else {
            console.log("No templates found");
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkData();
