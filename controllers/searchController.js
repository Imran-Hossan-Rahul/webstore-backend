import MarketProduct from "../models/MarketProduct.model.js";
import logger from "../utils/logger.js";

const parseQuery = (rawQuery) => {
    let q = rawQuery + ' ';
    const parsed = { category: null, tag: null, exact: null, text: '' };

    const catMatch = q.match(/category:(?:"([^"]+)"|([^\s]+))/i);
    if (catMatch) {
        parsed.category = catMatch[1] || catMatch[2];
        q = q.replace(catMatch[0], ' ');
    }

    const tagMatch = q.match(/(?:tag:|#)(?:"([^"]+)"|([^\s]+))/i);
    if (tagMatch) {
        parsed.tag = tagMatch[1] || tagMatch[2];
        q = q.replace(tagMatch[0], ' ');
    }

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
        if (finalFilter === false) return []; 

        if (!textQuery && !exactQuery) {
            return await model.find(finalFilter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate(populate || "")
                .lean();
        }

        if (exactQuery) {
            const regex = new RegExp(exactQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
            const orQuery = fields.map(field => ({ [field]: regex }));
            return await model.find({ ...finalFilter, $or: orQuery })
                .limit(limit)
                .populate(populate || "")
                .lean();
        }

        const regex = new RegExp(textQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        
        let textResults = [];
        try {
            textResults = await model.find(
                { ...finalFilter, $text: { $search: textQuery } },
                { score: { $meta: "textScore" } }
            )
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
            .populate(populate || "")
            .lean();
        } catch (e) {
            textResults = [];
        }

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
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.status(400).json({ success: false, message: "Query is required" });
    }
    
    const parsedQuery = parseQuery(q);
    
    const buildFilter = (baseFilter) => {
        const f = { ...baseFilter };
        if (parsedQuery.category) {
            f.category = new RegExp(parsedQuery.category.replace(/-/g, ' '), 'i');
        }
        if (parsedQuery.tag) {
            f.tags = new RegExp(parsedQuery.tag, 'i');
        }
        return f;
    };

    const marketFilter = buildFilter({ status: "Live" });

    const marketplace = await searchModel(
        MarketProduct, 
        parsedQuery.text, 
        parsedQuery.exact, 
        ['title', 'tags', 'category', 'brand'], 
        marketFilter, 
        null, 
        15
    );

    res.status(200).json({
      success: true,
      data: { marketplace },
      meta: { searchMethod: "robust_hybrid_advanced_search", totalResults: marketplace.length }
    });

  } catch (error) {
    logger.error("Global Search Error:", error);
    res.status(500).json({ success: false, message: "Server Error during search" });
  }
};
