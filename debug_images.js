
import mongoose from "mongoose";
import { connectToDatabase } from "./config/db.js";
import Codex from "./models/codex.model.js";
import Artifact from "./models/Artifact.model.js";

const checkData = async () => {
    try {
        await connectToDatabase();
        console.log("Connected to DB");

        // 1. Check ALL Codex
        const codex = await Codex.find({ isPublished: true }).select('title coverImage').lean();
        
        let urlCount = 0;
        let base64Count = 0;
        let nullCount = 0;
        let hugeExamples = [];

        codex.forEach(codex => {
            if (!codex.coverImage) {
                nullCount++;
            } else if (codex.coverImage.startsWith("http")) {
                urlCount++;
            } else {
                base64Count++;
                if (hugeExamples.length < 3) {
                    hugeExamples.push({
                        title: codex.title,
                        length: codex.coverImage.length,
                        preview: codex.coverImage.substring(0, 30)
                    });
                }
            }
        });

        console.log("\n--- CODEX STATS ---");
        console.log(`Total Codex: ${codex.length}`);
        console.log(`✅ Valid URLs: ${urlCount}`);
        console.log(`❌ Base64/Heavy: ${base64Count}`);
        console.log(`⚠️ No Image: ${nullCount}`);
        
        if (hugeExamples.length > 0) {
            console.log("\n--- PROBLEMATIC CODEXS (Base64) ---");
            hugeExamples.forEach(b => console.log(`- ${b.title} (Length: ${b.length} chars)`));
        }

        // 2. Check a Artifact
        const artifact = await Artifact.findOne({}).lean();
        if (artifact) {
            console.log("\n--- ARTIFACT DATA ---");
            console.log("Title:", artifact.title);
            // Check likely image fields
            const img = artifact.previewFile || artifact.coverImage || artifact.image;
            console.log("Image Type:", img ? (img.startsWith("http") ? "URL" : "Base64/Other") : "None");
            console.log("Image Preview:", img ? img.substring(0, 50) + "..." : "N/A");
             // Check if it has coverImage field too
            if (artifact.coverImage) {
                 console.log("Artifact CoverImage:", artifact.coverImage.substring(0, 50));
            }
        } else {
            console.log("No artifacts found");
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkData();


