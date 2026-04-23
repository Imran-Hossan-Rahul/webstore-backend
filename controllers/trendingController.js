import Post from '../models/Post.model.js';

/**
 * @desc    Get trending tags from posts
 * @route   GET /api/v1/feed/trending-tags
 * @access  Public
 */
export const getTrendingTags = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Aggregate tags from all active posts
        const trendingTags = await Post.aggregate([
            {
                $match: {
                    status: 'active',
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
                    totalLikes: { $sum: '$likes' },
                    totalViews: { $sum: '$views' }
                }
            },
            {
                $addFields: {
                    // Calculate trending score: count * 2 + likes + views/10
                    trendingScore: {
                        $add: [
                            { $multiply: ['$count', 2] },
                            '$totalLikes',
                            { $divide: ['$totalViews', 10] }
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
                    postCount: '$count',
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
        console.error('Error fetching trending tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trending tags',
            error: error.message
        });
    }
};
