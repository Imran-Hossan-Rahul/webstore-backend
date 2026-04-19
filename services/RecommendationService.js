import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Blog from "../models/blog.model.js";
import ButtonTemplate from "../models/Template.model.js"; // Assuming Template model name
import Follow from "../models/Follow.model.js";
import logger from "../utils/logger.js";

/**
 * Service to handle intelligent feed generation and content recommendation
 */
class RecommendationService {
  constructor() {
    // Weights for scoring
    this.weights = {
      recency: 0.4,
      popularity: 0.3,
      userAffinity: 0.3, // Interests, Following
    };
  }

  /**
   * Main entry point to get the personalized feed
   * @param {string|null} userId - Current user ID or null if guest
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} type - Filter by type (optional)
   */
  async getFeed(userId, page = 1, limit = 10, type = null) {
    try {
      const fetchStart = Date.now();
      
      // 1. Fetch User Context (if logged in)
      let userContext = {
        following: new Set(),
        interests: [],
        favorites: new Set(),
        skills: []
      };

      if (userId) {
        const [user, follows] = await Promise.all([
          User.findById(userId).select("interests skills favorites"),
          Follow.find({ follower: userId }).select("following"),
        ]);

        if (user) {
          userContext.interests = user.interests || [];
          userContext.skills = user.skills || [];
          userContext.favorites = new Set((user.favorites || []).map(id => id.toString()));
        }
        if (follows) {
          userContext.following = new Set(follows.map(f => f.following.toString()));
        }
      }

      // 2. Candidate Generation (Fetch raw items)
      // We fetch more than needed to allow for re-ranking
      const fetchLimit = limit * 5; // Fetch 5x to filter/rank
      const skip = (page - 1) * limit; // We still use skip for pagination, but ranking is tricky with skip.
      // Better approach for "Feed": Fetch *recent* pool + *trending* pool, merge, score, then slice.
      // For simple pagination V1: Just fetch sorted by date from DB, then re-rank the current page batch?
      // No, that doesn't bubble up old-but-good content.
      // Hybrid: Fetch latest (Recency) AND top rated (Popularity) separately?
      
      // Let's stick to a robust "Smart Fetch" that gets a large pool of "Recent & Active" content
      // For Page 1: We re-rank the top 200 items. 
      // For Page > 1: It gets harder to re-rank globally without heavy caching.
      // fallback: For now, we mainly rely on DB sort by createdAt for deep pagination, 
      // but for the first few pages (where it matters), we do heavy re-ranking.
      
      const queryOptions = {
        limit: fetchLimit,
        sort: { createdAt: -1 } // Initial candidate selection by recency
      };

      let candidates = [];

      // Fetch Templates
      if (!type || type === 'templates') {
        const templates = await ButtonTemplate.find({ isActive: true })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .populate("user", "name avatar profilePicture")
          .lean();
        candidates.push(...templates.map(t => ({ ...t, type: 'template' })));
      }

      // Fetch Blogs with manual author join (most reliable approach)
      if (!type || type === 'blogs') {
        // Step 1: Get blogs with raw author ObjectIds
        const rawBlogs = await Blog.find({ isPublished: true, isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .lean();

        // Step 2: Collect unique author IDs and batch fetch users
        const authorIds = [...new Set(rawBlogs.map(b => b.author?.toString()).filter(Boolean))];
        const authors = await User.find({ _id: { $in: authorIds } })
          .select('_id name profilePicture')
          .lean();
        const authorMap = Object.fromEntries(authors.map(u => [u._id.toString(), u]));

        // Attach author to each blog
        const blogs = rawBlogs.map(b => ({
          ...b,
          author: authorMap[b.author?.toString()] || null,
          user: authorMap[b.author?.toString()] || null
        }));

        candidates.push(...blogs.map(b => ({ ...b, type: 'blog' })));
      }

      // Fetch Posts
      if (!type || type === 'projects' || type === 'posts') {
        const posts = await Post.find({ status: "active", postType: { $ne: null } })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .populate({
              path: "user",
              select: "name profilePicture email creatorProfileId",
              populate: { path: "creatorProfileId", select: "profilePicture" }
          })
          .lean();
        candidates.push(...posts.map(p => ({ ...p, type: 'project' })));
      }

      // 3. Scoring & Ranking
      const scoredItems = candidates.map(item => {
        const score = this.calculateScore(item, userContext);
        return { ...item, score };
      });

      // Sort by computed score
      scoredItems.sort((a, b) => b.score - a.score);

      // 4. Pagination (Logic applied AFTER ranking the pool)
      // Note: This naive pool ranking works for Page 1 perfectly. 
      // For P2+, it might show duplicates if we re-fetch.
      // Ideal: Cursor-based or Seed-based.
      // Hack for V1: Use simple slicing on the pool. If they ask for page 2, we assume the pool hasn't changed drastically.
      // A truly robust feed needs Redis ZJSET.
      // We will slice the LOCAL sorted array.
      
      const paginatedItems = scoredItems.slice(0, limit); // Always take top N from the FRESH pool?
      // Wait, if user requests page 2, we need items N to 2N.
      // BUT if we re-rank every request, Page 2 might include items from Page 1 if scores shift.
      // For now, let's assume `page` is handled by the caller requesting a larger slice or we handle offset.
      
      // Correct Logic for Pool-based Paging without DB Offset:
      // We fetched `limit * 5` items (e.g. 50). 
      // If page=1 (0-10), page=2 (10-20). If page > 5, we fall back to standard DB sort via standard controllers usually.
      // Let's implement independent slicing here.
      
      // Actually, if we use `skip` in DB, we miss re-ranking potential for older items.
      // Let's stick to: "We rank the top X items likely to be relevant".
      // We return the slice based on proper pagination math.
      
      const startIndex = (page - 1) * limit;
      const finalSelection = scoredItems.slice(startIndex, startIndex + limit);

      // Map to standardized format (UI requires specific structures)
      const mappedFeed = finalSelection.map(item => this.normalizeItem(item, userId, userContext));

      // Debug
      // logger.info(`Feed Gen: ${mappedFeed.length} items. Top Score: ${mappedFeed[0]?.score}`);

      return {
        data: mappedFeed,
        hasMore: scoredItems.length > startIndex + limit
      };

    } catch (error) {
      logger.error("Feed Generation Error:", error);
      throw error;
    }
  }

  /**
   * Score a single item based on heuristics
   */
  calculateScore(item, userContext) {
    let score = 0;
    const now = Date.now();
    const createdAt = new Date(item.createdAt).getTime();
    
    // --- 1. Recency Decay (Exponential) ---
    // Newer items get much higher base score
    const ageInHours = (now - createdAt) / (1000 * 60 * 60);
    const recencyScore = 100 / Math.pow(ageInHours + 2, 1.5); 
    score += recencyScore;

    // --- 2. Engagement (Popularity) ---
    // Logarithmic scale to prevent virality from breaking everything
    const views = item.views || item.viewsCount || 0;
    const likes = item.likes || item.likesCount || item.likeCount || 0;
    const comments = item.commentsCount || (item.comments ? item.comments.length : 0);
    const downloads = item.downloadsCount || 0;

    const engagementScore = 
      (Math.log10(views + 1) * 2) + 
      (likes * 5) + 
      (comments * 8) + 
      (downloads * 10);
    
    score += engagementScore;

    // --- 3. User Affinity (Personalization) ---
    if (userContext) {
        // A. Social (Following)
        const authorId = item.user?._id || item.author?._id || item.user;
        if (authorId && userContext.following.has(authorId.toString())) {
            score += 50; // Huge boost for following
        }

        // B. Interests / Tags
        // Check overlap between item.tags/category and user.interests/skills
        const itemTags = item.tags || [item.category];
        if (itemTags && Array.isArray(itemTags)) {
            const matches = itemTags.filter(tag => 
                userContext.interests.includes(tag) || 
                userContext.skills.includes(tag)
            );
            score += (matches.length * 15);
        }
    }

    return score;
  }

  /**
   * Normalize item structure for Frontend
   */
  normalizeItem(item, currentUserId, userContext) {
    // Basic User Mapping
    const userMap = (u) => {
        if (!u) return { name: 'Unknown', avatar: '' };
        // Check if `u` is just an ID (if populate failed)
        if (u.constructor.name === 'ObjectId' || typeof u === 'string') return { _id: u };
        
        return {
            _id: u._id,
            name: u.name,
            username: u.username || (u.email ? u.email.split('@')[0] : 'user'),
            avatar: u.profilePicture || u.creatorProfileId?.profilePicture || u.avatar
        };
    };

    const author = item.user || item.author;
    const isLiked = currentUserId && (
        (item.likedBy && item.likedBy.some(id => id.toString() === currentUserId.toString())) || 
        (item.likes && Array.isArray(item.likes) && item.likes.some(id => id.toString() === currentUserId.toString()))
    );

    const base = {
        _id: item._id,
        type: item.type,
        createdAt: item.createdAt,
        user: userMap(author),
        views: item.views || item.viewsCount || 0,
        likes: Math.max(item.likesCount || 0, Array.isArray(item.likes) ? item.likes.length : (typeof item.likes === 'number' ? item.likes : (item.likeCount || 0))),
        commentsCount: Math.max(item.commentsCount || 0, Array.isArray(item.comments) ? item.comments.length : 0),
        isLiked: !!isLiked,
        debugScore: Math.round(item.score)
    };

    // Type Specific Fields
    if (item.type === 'project') {
        return {
            ...base,
            title: item.content ? item.content.replace(/<[^>]*>?/gm, '').substring(0, 80) : 'Project',
            content: item.content,
            coverImage: item.media?.[0]?.url || item.images?.[0] || null,
            images: item.images,
            media: item.media,
            projectStats: item.projectStats,
            cardShape: 'square-large'
        };
    } else if (item.type === 'template') {
        return {
            ...base,
            title: item.title,
            slug: item.slug,
            thumbnail: item.thumbnailSource || item.previewFile,
            previewFile: item.previewFile,
            price: item.price,
            priceType: item.priceType,
            downloadsCount: item.downloadsCount || 0,
            cardShape: item.cardShape || 'square-medium',
            description: item.description,
            category: item.category,
            tags: item.tags,
            tech: item.tech || [],
            fileSize: item.fileSize,
            fileType: item.fileType,
            versions: item.versions || [],
            githubLink: item.githubLink,
            liveLink: item.liveLink,
            codepenUrl: item.codepenUrl
        };
    } else if (item.type === 'blog') {
        // Calculate readTime from content word count (200 words per minute)
        const wordCount = item.content ? item.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
        const minutes = Math.max(1, Math.ceil(wordCount / 200));
        const readTime = `${minutes} min read`;

        // Normalize the author using userMap so profilePicture/avatar is always consistent
        const blogAuthor = item.author || item.user;
        const normalizedAuthor = blogAuthor ? {
            _id: blogAuthor._id,
            name: blogAuthor.name,
            profilePicture: blogAuthor.profilePicture || blogAuthor.avatar || null,
            avatar: blogAuthor.profilePicture || blogAuthor.avatar || null,
        } : null;

        return {
            ...base,
            title: item.title,
            coverImage: item.coverImage,
            excerpt: item.excerpt,
            slug: item.slug,
            cardShape: 'rectangle-small',
            tags: item.tags,
            readTime,
            author: normalizedAuthor,
            likedBy: Array.isArray(item.likes) ? item.likes.map(id => id.toString()) : []
        };
    }

    return base;
  }

  /**
   * Get suggested creators to follow
   */
  async getSuggestedCreators(userId, limit = 5) {
    try {
        // 1. Get current user's following list to exclude them
        let following = [];
        if (userId) {
            const follows = await Follow.find({ follower: userId }).select("following");
            following = follows.map(f => f.following.toString());
            following.push(userId.toString()); // Exclude self
        }

        // 2. Strategy: "Popular Creators" (Most followers) 
        // Since we don't have a direct "followersCount" on User (maybe we do?), we count Follow documents.
        // Optimization: Use CreatorProfile or User with fallback.
        // Aggregation is best here.

        const suggested = await Follow.aggregate([
            { $group: { _id: "$following", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $match: { _id: { $nin: following.map(id => new String(id)) } } }, // TODO: Fix ObjectId casting if needed
            { $limit: limit * 2 }, // Fetch double to filter further
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
            { $unwind: "$user" },
            { $project: {
                _id: "$user._id",
                name: "$user.name",
                avatar: "$user.profilePicture",
                username: "$user.username", // if exists
                followersCount: "$count"
            }}
        ]);

        return suggested.slice(0, limit);

    } catch (error) {
        logger.error("Suggested Creators Error:", error);
        return [];
    }
  }
}

export default new RecommendationService();
