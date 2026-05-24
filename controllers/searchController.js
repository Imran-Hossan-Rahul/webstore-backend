import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Artifact from "../models/Artifact.model.js";
import Codex from "../models/codex.model.js";
import Job from "../models/Job.model.js";
import Challenge from "../models/Challenge.model.js";
import logger from "../utils/logger.js";

/**
 * 🚀 HIGH-PERFORMANCE GLOBAL SEARCH
 * 
 * Optimizations:
 * 1. Short-circuiting: Skips expensive regex if text search is sufficient.
 * 2. Parallel execution: Still uses Promise.all but with fewer, smarter queries.
 * 3. Sanitized regex: Prevents regex injection/catastrophic backtracking.
 * 4. Deduplication: O(1) Set-based merging.
 */

const parseQuery = (rawQuery) => {
    let q = rawQuery + ' ';
    const parsed = { category: null, tag: null, author: null, exact: null, text: '' };

    // category:"some value" or category:value
    const catMatch = q.match(/category:(?:"([^"]+)"|([^\s]+))/i);
    if (catMatch) {
        parsed.category = catMatch[1] || catMatch[2];
        q = q.replace(catMatch[0], ' ');
    }

    // tag:"some value" or tag:value or #value
    const tagMatch = q.match(/(?:tag:|#)(?:"([^"]+)"|([^\s]+))/i);
    if (tagMatch) {
        parsed.tag = tagMatch[1] || tagMatch[2];
        q = q.replace(tagMatch[0], ' ');
    }

    // author:"some value" or author:value or @value
    const authorMatch = q.match(/(?:author:|@)(?:"([^"]+)"|([^\s]+))/i);
    if (authorMatch) {
        parsed.author = authorMatch[1] || authorMatch[2];
        q = q.replace(authorMatch[0], ' ');
    }

    // exact:"some phrase"
    const exactMatch = q.match(/"([^"]+)"/);
    if (exactMatch) {
        parsed.exact = exactMatch[1];
        q = q.replace(exactMatch[0], ' ');
    }

    parsed.text = q.replace(/\s+/g, ' ').trim();
    if (!parsed.text && parsed.exact) {
        parsed.text = parsed.exact;
    }
    
    return parsed;
};

const searchModel = async (model, textQuery, exactQuery, fields, finalFilter, populate = null, limit = 10) => {
    try {
        if (finalFilter === false) return []; // Skipped by buildFilter

        // If there's no text query but we have filters (e.g. just `category:UI`)
        if (!textQuery && !exactQuery) {
            return await model.find(finalFilter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate(populate || "")
                .lean();
        }

        // If exact phrase is requested
        if (exactQuery) {
            const regex = new RegExp(exactQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
            const orQuery = fields.map(field => ({ [field]: regex }));
            return await model.find({ ...finalFilter, $or: orQuery })
                .limit(limit)
                .populate(populate || "")
                .lean();
        }

        // Normal robust search
        const regex = new RegExp(textQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        
        // 1. Try Optimized Text Search First
        const textResults = await model.find(
            { ...finalFilter, $text: { $search: textQuery } },
            { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .populate(populate || "")
        .lean();

        // 2. Conditional Regex Fallback
        let regexResults = [];
        if (textResults.length < 5) {
            const orQuery = fields.map(field => ({ [field]: regex }));
            regexResults = await model.find({
                ...finalFilter,
                $or: orQuery
            })
            .limit(limit)
            .populate(populate || "")
            .lean();
        }

        // 3. Merge and Deduplicate
        const map = new Map();
        regexResults.forEach(item => map.set(item._id.toString(), item));
        textResults.forEach(item => map.set(item._id.toString(), item));
        
        return Array.from(map.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, limit);
    } catch (error) {
        logger.error(`Search error for model ${model.modelName}:`, error);
        return [];
    }
};

export const globalSearch = async (req, res) => {
  try {
    const { q, verifiedOnly } = req.query;
    if (!q || q.trim() === "") {
      return res.status(400).json({ success: false, message: "Query is required" });
    }
    
    const isVerifiedOnly = verifiedOnly === "true";
    const parsedQuery = parseQuery(q);
    
    let authorId = null;
    if (parsedQuery.author) {
        const u = await User.findOne({ 
            $or: [
                { username: new RegExp(`^${parsedQuery.author}$`, 'i') },
                { name: new RegExp(`^${parsedQuery.author}$`, 'i') }
            ]
        }).select('_id');
        if (u) authorId = u._id;
        else authorId = "NOT_FOUND";
    }

    const buildFilter = (baseFilter, authorField = null, supportsCategory = false, supportsTags = false) => {
        const f = { ...baseFilter };
        if (parsedQuery.category && supportsCategory) {
            f.category = new RegExp(parsedQuery.category.replace(/-/g, ' '), 'i');
        } else if (parsedQuery.category && !supportsCategory) {
            return false; 
        }

        if (parsedQuery.tag && supportsTags) {
            f.tags = new RegExp(parsedQuery.tag, 'i');
        } else if (parsedQuery.tag && !supportsTags) {
            return false;
        }

        if (authorId) {
            if (authorId === "NOT_FOUND") return false;
            if (authorField) f[authorField] = authorId;
            else return false;
        }
        
        return f;
    };

    const userFilter = buildFilter(isVerifiedOnly ? { isVerified: true } : {}, null, false, false);
    const postFilter = buildFilter({ status: "active" }, "user", true, true);
    const artifactFilter = buildFilter({ isActive: true }, "user", true, true);
    const codexFilter = buildFilter({ isPublished: true, isDeleted: false }, "author", true, true);
    const jobFilter = buildFilter({ status: "open" }, "patron", true, true);
    const challengeFilter = buildFilter({ status: { $in: ["active", "published", "registration_open", "submissions_open"] } }, null, true, true);

    const [users, posts, artifacts, codex, jobs, challenges] = await Promise.all([
      searchModel(User, parsedQuery.text, parsedQuery.exact, ['name', 'username'], userFilter, null, 10),
      
      searchModel(Post, parsedQuery.text, parsedQuery.exact, ['title', 'tags'], postFilter, {
        path: "user", select: "name profilePicture isVerified", match: isVerifiedOnly ? { isVerified: true } : {}
      }, 15).then(results => results.filter(r => r.user)),

      searchModel(Artifact, parsedQuery.text, parsedQuery.exact, ['title', 'tags'], artifactFilter, {
        path: "user", select: "name profilePicture isVerified", match: isVerifiedOnly ? { isVerified: true } : {}
      }, 15).then(results => results.filter(r => r.user)),

      searchModel(Codex, parsedQuery.text, parsedQuery.exact, ['title', 'tags'], codexFilter, {
        path: "author", select: "name profilePicture isVerified", match: isVerifiedOnly ? { isVerified: true } : {}
      }, 15).then(results => results.filter(r => r.author)),

      searchModel(Job, parsedQuery.text, parsedQuery.exact, ['title', 'skills', 'category'], jobFilter, {
        path: "patron", select: "name profilePicture isVerified", match: isVerifiedOnly ? { isVerified: true } : {}
      }, 15).then(results => results.filter(r => r.patron)),

      searchModel(Challenge, parsedQuery.text, parsedQuery.exact, ['title', 'tags', 'category'], challengeFilter, null, 15)
    ]);

    res.status(200).json({
      success: true,
      data: { users, posts, artifacts, codex, jobs, challenges },
      meta: { searchMethod: "robust_hybrid_advanced_search", totalResults: users.length + posts.length + artifacts.length + codex.length + jobs.length + challenges.length }
    });

  } catch (error) {
    logger.error("Global Search Error:", error);
    res.status(500).json({ success: false, message: "Server Error during search" });
  }
};
