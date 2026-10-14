import mongoose from "mongoose";
import dotenv from "dotenv";
import Blog from "../models/Blog.model.js";
import BlogCategory from "../models/BlogCategory.model.js";
import User from "../models/User.model.js";

// Load environment variables
dotenv.config({ path: ".env" });

const seedDemoBlog = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    // 1. Get an existing user to act as author
    const author = await User.findOne({});
    if (!author) {
      throw new Error("No users found in database to act as author. Please create a user first.");
    }
    console.log(`Using user ${author.name} (${author._id}) as author.`);

    // 2. Create or find a Category
    let category = await BlogCategory.findOne({ slug: "system-design" });
    if (!category) {
      category = await BlogCategory.create({
        name: { en: "System Design", bn: "সিস্টেম ডিজাইন" },
        slug: "system-design",
        description: { en: "Architecture and scaling", bn: "আর্কিটেকচার এবং স্কেলিং" }
      });
      console.log("Created 'System Design' category.");
    }

    // 3. Create the Demo Blog
    const demoSlug = `scalable-architecture-demo-${Date.now()}`;
    const demoBlog = await Blog.create({
      slug: demoSlug,
      author: author._id,
      category: category._id,
      status: "published",
      publishedAt: new Date(),
      coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop",
      tags: ["Node.js", "Redis", "Scalability", "Backend"],
      availableLanguages: ["en", "bn"],
      views: 120,
      readTime: 6,
      en: {
        title: "Building a Highly Scalable Architecture with Node.js and Redis",
        excerpt: "Learn how to handle millions of requests by implementing a robust caching strategy and background job queues.",
        content: `
<h2>Why Scale with Redis?</h2>
<p>When your database gets hit with thousands of identical read requests, your server response time drops significantly. Redis acts as an in-memory data structure store, sitting between your API and your database.</p>

<h3>1. Implementing the Caching Layer</h3>
<pre><code class="language-javascript">
import redis from "../config/redis.js";
import Blog from "../models/Blog.model.js";

export const getBlogs = async (req, res) => {
  const cacheKey = "blogs:all:published";
  const cachedData = await redis.get(cacheKey);
  if (cachedData) return res.status(200).json(JSON.parse(cachedData));

  const blogs = await Blog.find({ status: "published" }).lean();
  await redis.set(cacheKey, JSON.stringify(blogs), "EX", 3600);
  return res.status(200).json(blogs);
};
</code></pre>
<p>This is a seeded demo post injected directly into the database.</p>
        `,
        seoTitle: "Scalable Node.js Architecture",
        keywords: ["Node.js", "Redis"]
      },
      bn: {
        title: "Node.js এবং Redis দিয়ে হাইলি স্কেলেবল আর্কিটেকচার তৈরি",
        excerpt: "জানুন কীভাবে Node.js, Redis এবং BullMQ ব্যবহার করে পাওয়ারফুল ক্যাশিং স্ট্র্যাটেজি ইমপ্লিমেন্ট করা যায়।",
        content: `
<h2>কেন Redis দিয়ে স্কেল করবেন?</h2>
<p>আপনার ডাটাবেসে যখন হাজার হাজার ইউজার একই ডেটা বারবার রিকোয়েস্ট করে, তখন ডাটাবেস স্লো হয়ে যায়। Redis একটি ইন-মেমোরি ক্যাশ হিসেবে কাজ করে।</p>

<h3>১. ক্যাশিং লেয়ার ইমপ্লিমেন্টেশন</h3>
<pre><code class="language-javascript">
import redis from "../config/redis.js";
import Blog from "../models/Blog.model.js";

export const getBlogs = async (req, res) => {
  const cacheKey = "blogs:all:published";
  const cachedData = await redis.get(cacheKey);
  if (cachedData) return res.status(200).json(JSON.parse(cachedData));

  const blogs = await Blog.find({ status: "published" }).lean();
  await redis.set(cacheKey, JSON.stringify(blogs), "EX", 3600);
  return res.status(200).json(blogs);
};
</code></pre>
<p>এটি একটি ডেমো পোস্ট যা সরাসরি ডাটাবেসে ইনজেক্ট করা হয়েছে।</p>
        `,
        seoTitle: "স্কেলেবল Node.js আর্কিটেকচার",
        keywords: ["Node.js", "Redis"]
      }
    });

    console.log(`Successfully seeded blog: ${demoBlog.slug}`);
    console.log("Check http://localhost:3000/blog to see it!");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding blog:", error);
    process.exit(1);
  }
};

seedDemoBlog();
