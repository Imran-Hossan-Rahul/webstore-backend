import Artifact from '../models/Artifact.model.js';

/**
 * @desc    Get popular artifact categories with counts
 * @route   GET /api/v1/artifact/popular-categories
 * @access  Public
 */
export const getPopularCategories = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const categories = await Artifact.aggregate([
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
                    artifactCount: '$count',
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
 * @desc    Get trending artifact tags
 * @route   GET /api/v1/artifact/trending-tags
 * @access  Public
 */
export const getTrendingArtifactTags = async (req, res) => {
    try {
        const { limit = 8 } = req.query;

        const trendingTags = await Artifact.aggregate([
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
                    artifactCount: '$count',
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
        console.error('Error fetching trending artifact tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trending artifact tags',
            error: error.message
        });
    }
};


