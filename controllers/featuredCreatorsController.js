import User from '../models/User.model.js';
import Post from '../models/Post.model.js';

/**
 * @desc    Get featured/random creators for spotlight
 * @route   GET /api/v1/users/featured-creators
 * @access  Public
 */
export const getFeaturedCreators = async (req, res) => {
    try {
        const { limit = 1 } = req.query;

        // Get random creators who have role 'creator' and have at least one post
        const creators = await User.aggregate([
            {
                $match: {
                    role: 'creator',
                    isActive: { $ne: false } // Exclude inactive users
                }
            },
            {
                $lookup: {
                    from: 'posts',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'posts'
                }
            },
            {
                $addFields: {
                    postCount: { $size: '$posts' }
                }
            },
            {
                $match: {
                    postCount: { $gt: 0 } // Only creators with at least 1 post
                }
            },
            {
                $sample: { size: parseInt(limit) } // Random selection
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    avatar: 1,
                    bio: 1,
                    role: 1,
                    skills: 1,
                    location: 1,
                    website: 1,
                    postCount: 1,
                    createdAt: 1
                }
            }
        ]);

        // Get 3 recent posts for each creator
        const creatorsWithPosts = await Promise.all(
            creators.map(async (creator) => {
                const recentPosts = await Post.find({ user: creator._id })
                    .select('images')
                    .sort({ createdAt: -1 })
                    .limit(3);

                return {
                    ...creator,
                    recentPosts: recentPosts.map(post => ({
                        images: post.images
                    }))
                };
            })
        );

        res.status(200).json({
            success: true,
            data: creatorsWithPosts
        });
    } catch (error) {
        console.error('Error fetching featured creators:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured creators',
            error: error.message
        });
    }
};
