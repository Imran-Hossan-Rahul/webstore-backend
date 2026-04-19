import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Template from "../models/Template.model.js";
import Blog from "../models/blog.model.js"; // Assuming this model exists, otherwise will skip

export const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.status(400).json({ success: false, message: "Query is required" });
    }

    const searchQuery = q.trim();
    const regex = new RegExp(searchQuery, "i"); // Case-insensitive regex

    // parallel queries for performance
    const [users, posts, templates, blogs] = await Promise.all([
      // 1. Search Users (Name, Email, Bio)
      User.find({
        $or: [
          { name: regex },
          { email: regex },
          { bio: regex },
          { skills: { $in: [regex] } } // Also search skills if applicable
        ]
      })
      .select("name profilePicture bio hasCreatorAccount followers count")
      .limit(10),

      // 2. Search Posts (Title, content, tags)
      Post.find({
        $or: [
          { "projectStats.tools": { $in: [regex] } }, // Search tools
          { tags: { $in: [regex] } },
          { content: regex }, // Note: Searching content might be heavy, limit this if needed
          { category: regex }
        ]
      })
      .populate("user", "name profilePicture")
      .sort({ createdAt: -1 })
      .limit(10),
      
      // 3. Search Templates (Title, Description, Tags)
      Template.find({
        $or: [
          { title: regex },
          { description: regex },
          { tags: { $in: [regex] } }
        ]
      })
      .populate("creator", "name profilePicture")
      .sort({ popularityScore: -1 })
      .limit(10),

      // 4. Search Blogs (Title, Content, Tags)
      Blog.find({
         $or: [
             { title: regex },
             { content: regex },
             { tags: { $in: [regex] } }
         ]
      })
      .populate("author", "name profilePicture")
      .limit(10)
    ]);

    // Normalize results
    res.status(200).json({
      success: true,
      data: {
        users,
        posts, // Projects/Thoughts
        templates,
        blogs
      }
    });

  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ success: false, message: "Server Error during search" });
  }
};
