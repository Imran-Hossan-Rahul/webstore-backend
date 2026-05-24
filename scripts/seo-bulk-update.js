/**
 * Codalina — Bulk SEO Optimizer for Codex Articles
 * 
 * This script connects to MongoDB, reads all published codex articles,
 * and automatically generates professional SEO titles, meta descriptions,
 * and focus keywords based on the content — then saves them back.
 * 
 * Run: node scripts/seo-bulk-update.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { stripHtml } from "string-strip-html";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/";

// ─────────────────────────────────────────────
// SEO Generation Engine
// ─────────────────────────────────────────────

/**
 * Extracts plain text from HTML content
 */
function toPlainText(html = "") {
    return stripHtml(html).result.replace(/\s+/g, " ").trim();
}

/**
 * Generates an SEO-optimized title (max 60 chars)
 * Keeps the original intent but adds power words and year if needed
 */
function generateSeoTitle(title = "", category = "") {
    // Clean up the title
    let seo = title.trim();
    
    // Remove common weak openers
    seo = seo.replace(/^(a guide to|how to use|introduction to|using|understanding)\s+/i, "");
    
    // Add year if it's a "how to" or tutorial type (boosts CTR)
    const isTutorial = /tutorial|guide|how to|learn|step by step|complete/i.test(title);
    const hasYear = /20\d\d/.test(title);
    
    if (isTutorial && !hasYear && seo.length < 48) {
        seo = `${seo} (2025 Guide)`;
    }
    
    // Append category context if title is very short
    if (seo.length < 25 && category && category !== "uncategorized") {
        seo = `${seo} — ${category} Tutorial`;
    }
    
    // Truncate to 60 chars at word boundary
    if (seo.length > 60) {
        seo = seo.substring(0, 57) + "...";
    }
    
    return seo;
}

/**
 * Generates a compelling meta description (max 155 chars)
 * Pulls from excerpt or first meaningful paragraph
 */
function generateSeoDescription(title = "", content = "", excerpt = "", tags = []) {
    // Priority 1: Use excerpt if good enough
    if (excerpt && excerpt.length >= 80 && excerpt.length <= 155) {
        return excerpt.trim();
    }

    // Priority 2: Extract from plain-text content
    const plain = toPlainText(content);
    
    // Split by sentence endings and filter meaningful ones
    const sentences = plain
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        // Skip sentences that are just repeating the title (common in these articles)
        .filter(s => {
            if (s.length < 50) return false;
            // Skip if it's basically the title
            const titleWords = title.toLowerCase().split(" ").filter(w => w.length > 4);
            const matchCount = titleWords.filter(w => s.toLowerCase().includes(w)).length;
            if (matchCount > titleWords.length * 0.7 && s.length < 120) return false;
            return true;
        });
    
    if (sentences.length > 0) {
        let desc = sentences[0];
        // Clean any leading artifacts like "js:", ":", "-"
        desc = desc.replace(/^[^a-zA-Z]+/, "").trim();
        if (desc.length > 155) desc = desc.substring(0, 152) + "...";
        if (desc.length >= 80) return desc;
    }

    // Try second sentence if first was filtered
    if (sentences.length > 1) {
        let desc = sentences[1].replace(/^[^a-zA-Z]+/, "").trim();
        if (desc.length > 155) desc = desc.substring(0, 152) + "...";
        if (desc.length >= 60) return desc;
    }
    
    // Fallback: Generate from title + tags
    const mainTopic = title.split(":")?.[0]?.trim() || title;
    const tagStr = tags.slice(0, 3).join(", ");
    const fallback = `A deep-dive into ${mainTopic}${tagStr ? ` — covering ${tagStr}` : ""}. Written by expert craftsmen on Codalina.`;
    return fallback.substring(0, 155);
}

/**
 * Generates focus keywords from title, tags and content
 * Returns 3-5 targeted keywords
 */
function generateFocusKeywords(title = "", tags = [], content = "", category = "") {
    const keywords = new Set();
    
    // 1. Primary keyword = the core topic from title
    const cleanTitle = title.replace(/[^\w\s]/g, "").toLowerCase();
    keywords.add(cleanTitle.trim());
    
    // 2. Add existing tags (they're already relevant)
    tags.slice(0, 3).forEach(t => keywords.add(t.toLowerCase()));
    
    // 3. Extract key technical terms from content (first 1000 chars)
    const plain = toPlainText(content).substring(0, 1000).toLowerCase();
    
    // Common high-value dev keywords to look for in content
    const techTerms = [
        "javascript", "typescript", "react", "next.js", "node.js", "express",
        "mongodb", "postgresql", "docker", "kubernetes", "rest api", "graphql",
        "css", "tailwind", "webpack", "vite", "git", "github", "linux",
        "python", "golang", "rust", "php", "mysql", "redis", "aws", "vercel",
        "authentication", "jwt", "oauth", "security", "performance", "deployment",
        "testing", "debugging", "nodemon", "npm", "yarn", "pnpm"
    ];
    
    techTerms.forEach(term => {
        if (plain.includes(term)) keywords.add(term);
    });
    
    // 4. Add a long-tail variation  
    const mainTopic = title.split(":")[0].trim().toLowerCase();
    if (mainTopic.length > 3) {
        keywords.add(`${mainTopic} tutorial`);
        keywords.add(`how to use ${mainTopic}`);
    }
    
    // Return top 5 unique, non-empty keywords
    return [...keywords]
        .filter(k => k && k.length > 2 && k.length < 50)
        .slice(0, 5);
}

// ─────────────────────────────────────────────
// Main Script
// ─────────────────────────────────────────────

async function run() {
    console.log("\n🚀 Codalina SEO Bulk Optimizer\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Define minimal schema inline to avoid importing full model stack
    const codexSchema = new mongoose.Schema({}, { strict: false });
    const Codex = mongoose.models.Codex || mongoose.model("Codex", codexSchema, "codexes");

    // Fetch all published, non-deleted articles
    const articles = await Codex.find({ 
        isDeleted: { $ne: true },
    }).lean();

    console.log(`📚 Found ${articles.length} codex articles\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    let updated = 0;
    let skipped = 0;

    for (const article of articles) {
        const { _id, title, content = "", excerpt = "", tags = [], category = "" } = article;
        
        if (!title || !content) {
            console.log(`⚠️  SKIP: No title/content — ${_id}`);
            skipped++;
            continue;
        }

        // Skip garbage/test articles (very short titles or test data)
        const plainTitle = toPlainText(title).trim();
        if (plainTitle.length < 5 || /^(test|table|asdf|sdf|lorem|undefined|null)/i.test(plainTitle)) {
            console.log(`🗑️  SKIP (garbage): "${plainTitle}"`);
            skipped++;
            continue;
        }

        // Generate SEO fields
        const seoTitle = generateSeoTitle(title, category);
        const seoDescription = generateSeoDescription(title, content, excerpt, tags);
        const focusKeywords = generateFocusKeywords(title, tags, content, category);

        // Update in DB
        await Codex.updateOne(
            { _id },
            { $set: { seoTitle, seoDescription, focusKeywords } }
        );

        console.log(`✅ UPDATED: "${title.substring(0, 50)}..."`);
        console.log(`   📌 SEO Title:  ${seoTitle}`);
        console.log(`   📝 Meta Desc:  ${seoDescription.substring(0, 80)}...`);
        console.log(`   🏷️  Keywords:   ${focusKeywords.join(", ")}`);
        console.log();
        
        updated++;
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🎉 Done! Updated: ${updated} | Skipped: ${skipped}`);
    console.log("\n📋 Next steps:");
    console.log("   1. Deploy your frontend to Vercel");
    console.log("   2. Go to Google Search Console");
    console.log("   3. Submit sitemap: /sitemap.xml");
    console.log("   4. Request indexing for your top 10 articles\n");

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error("❌ Script failed:", err);
    mongoose.disconnect();
    process.exit(1);
});
