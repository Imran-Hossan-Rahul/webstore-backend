import User from '../models/User.model.js';
import Post from '../models/Post.model.js';
import CraftsmanProfile from '../models/CraftsmanProfile.model.js';

/**
 * @desc    Get top-ranked craftsmen for spotlight based on engagement score
 *          Score = (total likes × 3) + (total views × 1) + (post count × 5)
 *          Only devlog-type posts are counted.
 * @route   GET /api/v1/users/featured-craftsmen
 * @access  Public
 */
export const getFeaturedCraftsmen = async (req, res) => {
    try {
        const { limit = 3 } = req.query;
        const parsedLimit = Math.min(parseInt(limit) || 3, 10);

        const craftsmen = await User.aggregate([
            // Step 1: Only active craftsmen
            {
                $match: {
                    hasCraftsmanAccount: true,
                    isActive: { $ne: false }
                }
            },

            // Step 2: Join their devlog posts (postType: 'devlog')
            {
                $lookup: {
                    from: 'posts',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$user', '$$userId'] },
                                postType: 'devlog',   // ✅ correct field name
                                status: { $ne: 'deleted' }
                            }
                        },
                        {
                            $project: {
                                likes: 1,
                                views: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    as: 'devlogs'
                }
            },

            // Step 3: Must have at least 1 devlog (no minimum threshold — important for new platforms)
            {
                $match: {
                    'devlogs.0': { $exists: true }
                }
            },

            // Step 4: Compute engagement score
            {
                $addFields: {
                    postCount: { $size: '$devlogs' },
                    totalLikes: { $sum: '$devlogs.likes' },
                    totalViews: { $sum: '$devlogs.views' },
                    // Score formula: likes×3 + views×1 + posts×5
                    engagementScore: {
                        $add: [
                            { $multiply: [{ $sum: '$devlogs.likes' }, 3] },
                            { $multiply: [{ $sum: '$devlogs.views' }, 1] },
                            { $multiply: [{ $size: '$devlogs' }, 5] }
                        ]
                    }
                }
            },

            // Step 5: Sort by engagement score descending
            {
                $sort: { engagementScore: -1 }
            },

            // Step 6: Take top N
            {
                $limit: parsedLimit
            },

            // Step 7: Project final shape
            {
                $project: {
                    _id: 1,
                    name: 1,
                    username: 1,
                    profilePicture: 1,
                    bio: 1,
                    skills: 1,
                    postCount: 1,
                    totalLikes: 1,
                    totalViews: 1,
                    engagementScore: 1,
                    createdAt: 1,
                    gamification: 1,
                    craftsmanProfileId: 1
                }
            }
        ]);

        // Attach avatar field for frontend compatibility
        const result = craftsmen.map(c => ({
            ...c,
            avatar: c.profilePicture || null
        }));

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching featured craftsmen:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured craftsmen',
            error: error.message
        });
    }
};
