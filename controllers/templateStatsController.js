import ButtonTemplate from '../models/Template.model.js';

/**
 * @desc    Get popular template categories with counts
 * @route   GET /api/v1/template/popular-categories
 * @access  Public
 */
export const getPopularCategories = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const categories = await ButtonTemplate.aggregate([
            {
                $match: {
                    status: 'approved',
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalViews: { $sum: '$viewsCount' },
                    totalDownloads: { $sum: '$downloadsCount' }
                }
            },
            {
                $addFields: {
                    popularityScore: {
                        $add: [
                            { $multiply: ['$count', 2] },
                            { $divide: ['$totalViews', 10] },
                            { $multiply: ['$totalDownloads', 5] }
                        ]
                    }
                }
            },
            {
                $sort: { popularityScore: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    templateCount: '$count',
                    views: '$totalViews',
                    downloads: '$totalDownloads',
                    popularityScore: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: categories
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

/**
 * @desc    Get trending template tags
 * @route   GET /api/v1/template/trending-tags
 * @access  Public
 */
export const getTrendingTemplateTags = async (req, res) => {
    try {
        const { limit = 8 } = req.query;

        const trendingTags = await ButtonTemplate.aggregate([
            {
                $match: {
                    status: 'approved',
                    isActive: true,
                    tags: { $exists: true, $ne: [] }
                }
            },
            {
                $unwind: '$tags'
            },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 },
                    totalLikes: { $sum: '$likeCount' },
                    totalViews: { $sum: '$viewsCount' }
                }
            },
            {
                $addFields: {
                    trendingScore: {
                        $add: [
                            { $multiply: ['$count', 3] },
                            { $multiply: ['$totalLikes', 2] },
                            { $divide: ['$totalViews', 5] }
                        ]
                    }
                }
            },
            {
                $sort: { trendingScore: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    _id: 0,
                    tag: '$_id',
                    templateCount: '$count',
                    likes: '$totalLikes',
                    views: '$totalViews',
                    trendingScore: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: trendingTags
        });
    } catch (error) {
        console.error('Error fetching trending template tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trending template tags',
            error: error.message
        });
    }
};
