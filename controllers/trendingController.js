import Post from '../models/Post.model.js';

/**
 * @desc    Get trending tags from posts (Dynamic Algorithm)
 * @route   GET /api/v1/feed/trending-tags
 * @access  Public (Optional Auth)
 */
export const getTrendingTags = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const user = req.user; // from optionalProtect

        // Fetch all active tags without hard date limits to ensure we always have data
        // even if the platform is new or sparsely populated.
        const getModelTags = async (Model, match = {}) => {
            return await Model.aggregate([
                { $match: match },
                { 
                    $addFields: { 
                        combinedTags: { 
                            $setUnion: [ 
                                { $ifNull: ['$tags', []] }, 
                                { $ifNull: ['$devlogStats.tools', []] },
                                { $ifNull: ['$skills', []] } // In case Artifacts/Codex uses skills
                            ] 
                        } 
                    } 
                },
                { $match: { combinedTags: { $exists: true, $ne: [], $not: { $size: 0 } } } },
                { $unwind: '$combinedTags' },
                { 
                    $group: { 
                        _id: '$combinedTags', 
                        count: { $sum: 1 }, 
                        likes: { $sum: { $ifNull: ['$likeCount', { $ifNull: ['$likesCount', { $ifNull: ['$likes', 0] }] }] } }, 
                        views: { $sum: { $ifNull: ['$viewsCount', { $ifNull: ['$views', 0] }] } },
                        // Store the most recent creation date for this tag to apply time decay
                        latestActivity: { $max: "$createdAt" }
                    } 
                }
            ]);
        };

        const [postTags, artifactTags, codexTags] = await Promise.all([
            getModelTags(Post, { status: 'active' }),
            import('../models/Artifact.model.js').then(m => getModelTags(m.default, { isActive: true })),
            import('../models/Codex.model.js').then(m => getModelTags(m.default, { isPublished: true, isDeleted: false }))
        ]);

        // Merge results
        const tagMap = new Map();
        [...postTags, ...artifactTags, ...codexTags].forEach(item => {
            const existing = tagMap.get(item._id) || { count: 0, likes: 0, views: 0, latestActivity: item.latestActivity };
            tagMap.set(item._id, {
                count: existing.count + item.count,
                likes: existing.likes + item.likes,
                views: existing.views + item.views,
                latestActivity: item.latestActivity > existing.latestActivity ? item.latestActivity : existing.latestActivity
            });
        });

        // User preferences for personalization
        const userInterests = new Set();
        if (user) {
            if (user.skills) user.skills.forEach(s => userInterests.add(s.toLowerCase()));
            if (user.interests) user.interests.forEach(i => userInterests.add(i.toLowerCase()));
        }

        const now = new Date();

        const trendingTags = Array.from(tagMap.entries()).map(([tag, stats]) => {
            // 1. Base Score
            // Base weight: 1 post = 10 pts, 1 like = 5 pts, 5 views = 1 pt
            const baseScore = (stats.count * 10) + (stats.likes * 5) + (stats.views / 5);

            // 2. Time Decay Multiplier
            // If the latest activity for this tag is recent, boost it.
            let timeDecay = 0.5; // Older than 30 days
            if (stats.latestActivity) {
                const daysOld = (now - new Date(stats.latestActivity)) / (1000 * 60 * 60 * 24);
                if (daysOld <= 7) timeDecay = 1.5; // Within last week
                else if (daysOld <= 30) timeDecay = 1.0; // Within last month
            }

            // 3. Personalization Multiplier
            let personalization = 1.0;
            if (userInterests.has(tag.toLowerCase())) {
                personalization = 2.0; // 2x boost if it matches user's skills/interests
            }

            // Final Score
            const trendingScore = baseScore * timeDecay * personalization;

            return {
                tag,
                postCount: stats.count,
                likes: stats.likes,
                views: stats.views,
                trendingScore
            };
        }).sort((a, b) => b.trendingScore - a.trendingScore).slice(0, parseInt(limit));

        res.status(200).json({
            success: true,
            data: trendingTags
        });
    } catch (error) {
        console.error('Error fetching trending tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trending tags',
            error: error.message
        });
    }
};

/**
 * @desc    Get popular categories across all content types (Posts, Artifacts, Codex)
 * @route   GET /api/v1/feed/popular-categories
 * @access  Public
 */
export const getPopularCategories = async (req, res) => {
    try {
        const { limit = 8 } = req.query;

        const getModelCategories = async (Model, match = {}) => {
            return await Model.aggregate([
                { $match: { ...match, category: { $exists: true, $ne: "", $ne: "uncategorized" } } },
                { 
                    $group: { 
                        _id: '$category', 
                        count: { $sum: 1 }, 
                        views: { $sum: { $ifNull: ['$viewsCount', { $ifNull: ['$views', 0] }] } }
                    } 
                }
            ]);
        };

        const [postCats, artifactCats, codexCats] = await Promise.all([
            getModelCategories(Post, { status: 'active' }),
            import('../models/Artifact.model.js').then(m => getModelCategories(m.default, { status: 'approved', isActive: true })),
            import('../models/Codex.model.js').then(m => getModelCategories(m.default, { isPublished: true, isDeleted: false }))
        ]);

        const categoryMap = new Map();
        [...postCats, ...artifactCats, ...codexCats].forEach(item => {
            const existing = categoryMap.get(item._id) || { count: 0, views: 0 };
            categoryMap.set(item._id, {
                count: existing.count + item.count,
                views: existing.views + item.views
            });
        });

        const popularCategories = Array.from(categoryMap.entries()).map(([category, stats]) => {
            // Base Score: 1 item = 10 pts, 1 view = 1 pt
            const popularityScore = (stats.count * 10) + stats.views;
            return {
                category,
                artifactCount: stats.count, // Using artifactCount for frontend compatibility
                views: stats.views,
                popularityScore
            };
        }).sort((a, b) => b.popularityScore - a.popularityScore).slice(0, parseInt(limit));

        res.status(200).json({
            success: true,
            data: popularCategories
        });
    } catch (error) {
        console.error('Error fetching popular categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch popular categories',
            error: error.message
        });
    }
};

