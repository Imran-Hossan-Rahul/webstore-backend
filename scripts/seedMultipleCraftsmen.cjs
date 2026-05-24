const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Simple direct schemas to avoid importing complex model logic
const UserSchema = new mongoose.Schema({}, { strict: false });
const CraftsmanProfileSchema = new mongoose.Schema({}, { strict: false });
const JobSchema = new mongoose.Schema({}, { strict: false });
const ChallengeSchema = new mongoose.Schema({}, { strict: false });
const CodexSchema = new mongoose.Schema({}, { strict: false });
const ArtifactSchema = new mongoose.Schema({}, { strict: false });
const PostSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', UserSchema);
const CraftsmanProfile = mongoose.model('CraftsmanProfile', CraftsmanProfileSchema);
const Job = mongoose.model('Job', JobSchema);
const Challenge = mongoose.model('Challenge', ChallengeSchema);
const Codex = mongoose.model('Codex', CodexSchema);
const Artifact = mongoose.model('Artifact', ArtifactSchema);
const Post = mongoose.model('Post', PostSchema);

const MONGODB_URI = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/test';

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];

const TITLES = [
  "E-commerce Dashboard", "React Native Crypto Wallet", "AI Chatbot Interface",
  "Fintech Analytics App", "Social Media Feed Redesign", "Real Estate CRM",
  "Web3 NFT Marketplace", "Healthcare Portal", "SaaS Admin Panel", "Fitness Tracking App"
];

const DEVLOG_TITLES = [
  "Building the Core Architecture", "Solving the Caching Issue", "Implementing WebSockets",
  "Optimizing DB Queries", "Designing the UI System", "Fixing Memory Leaks",
  "Deploying to Kubernetes", "Refactoring React Components", "Setting up CI/CD", "Integrating Stripe"
];

const CATEGORIES = ["development", "design", "security", "blockchain", "AI"];
const TAGS = ["React", "Node.js", "TailwindCSS", "MongoDB", "Figma", "AWS", "Python"];
const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80"
];

const AVATARS = [
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/86.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/men/22.jpg"
];

const NEW_CRAFTSMEN = [
  { name: "Alex Morgan", email: "alex.demo@example.com", username: "alexm" },
  { name: "Sarah Chen", email: "sarah.demo@example.com", username: "sarahc" },
  { name: "David Kim", email: "david.demo@example.com", username: "davidk" },
  { name: "Elena Rodriguez", email: "elena.demo@example.com", username: "elenar" },
  { name: "James Wilson", email: "james.demo@example.com", username: "jamesw" }
];

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  for (let i = 0; i < NEW_CRAFTSMEN.length; i++) {
    const craftsmanInfo = NEW_CRAFTSMEN[i];
    console.log(`\n========================================`);
    console.log(`Seeding data for ${craftsmanInfo.name}...`);
    
    // Create User
    const userDoc = new User({
      name: craftsmanInfo.name,
      email: craftsmanInfo.email,
      username: craftsmanInfo.username,
      profilePicture: AVATARS[i],
      avatar: AVATARS[i],
      role: 'craftsman',
      gamification: {
        xp: randomInt(5000, 50000),
        level: randomInt(5, 50),
        points: randomInt(500, 5000),
      },
      createdAt: new Date()
    });
    await userDoc.save();
    const userId = userDoc._id;

    // Create CraftsmanProfile
    const profileDoc = new CraftsmanProfile({
      userId: userId,
      displayName: craftsmanInfo.name,
      bio: `Hi, I am ${craftsmanInfo.name}, a passionate developer and designer.`,
      profilePicture: AVATARS[i],
      level: randomItem(["beginner", "intermediate", "expert", "pro"]),
      rating: (Math.random() * (5 - 3.5) + 3.5).toFixed(1),
      skills: ["React", "Node.js", "UI/UX"],
      isActive: true,
      createdAt: new Date()
    });
    await profileDoc.save();

    console.log(`User created. Generating 250 items...`);

    const jobs = [];
    const challenges = [];
    const codexes = [];
    const artifacts = [];
    const posts = [];

    for (let j = 0; j < 50; j++) {
      const now = new Date();
      now.setSeconds(now.getSeconds() - j * 100);

      // Job
      jobs.push({
        patron: userId,
        title: `[Demo] ${randomItem(TITLES)} - Job ${j + 1}`,
        description: "This is a demo job description created for testing the platform showcase.",
        skillsRequired: [randomItem(TAGS), randomItem(TAGS)],
        budget: { type: "fixed", min: randomInt(100, 500), max: randomInt(500, 2000), currency: "USD" },
        status: "open",
        visibility: "public",
        createdAt: now
      });

      // Challenge
      challenges.push({
        title: `[Demo] ${randomItem(TITLES)} - Challenge ${j + 1}`,
        description: "A demo challenge for developers to test their skills and win prizes.",
        status: "published",
        category: randomItem(CATEGORIES),
        skills: [randomItem(TAGS)],
        prizePool: {
          currency: "USD",
          total: randomInt(1000, 5000),
          distribution: [{ rank: 1, amount: 500 }]
        },
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + randomInt(10, 30) * 86400000),
        createdAt: now
      });

      // Codex
      codexes.push({
        title: `[Demo] ${randomItem(TITLES)} - Codex ${j + 1}`,
        slug: `demo-codex-${userId}-${j}-${Date.now()}`,
        content: "<h2>Demo Codex Content</h2><p>This is a highly detailed codex guide with demo text.</p>",
        excerpt: "This is a brief summary of the codex. Highlighting <mark>important terms</mark> for testing.",
        author: userId,
        category: randomItem(CATEGORIES),
        tags: [randomItem(TAGS), randomItem(TAGS)],
        coverImage: randomItem(IMAGE_URLS),
        isPublished: true,
        isDeleted: false,
        views: randomInt(10, 500),
        createdAt: now
      });

      // Artifact
      artifacts.push({
        title: `[Demo] ${randomItem(TITLES)} - Artifact ${j + 1}`,
        description: "A beautiful UI component or design asset for your next project.",
        user: userId,
        category: randomItem(CATEGORIES),
        tags: [randomItem(TAGS)],
        price: randomInt(0, 50),
        fileUrl: "https://example.com/demo.zip",
        previewImage: randomItem(IMAGE_URLS),
        status: "approved",
        isActive: true,
        downloads: randomInt(0, 100),
        createdAt: now
      });

      // Devlog (Post)
      posts.push({
        user: userId,
        title: `[Demo] ${randomItem(DEVLOG_TITLES)} - Devlog ${j + 1}`,
        slug: `demo-devlog-${userId}-${j}-${Date.now()}`,
        content: "Today I worked on the core features. I refactored the database schema and improved response times by 50%. It was a great day of coding.",
        images: [randomItem(IMAGE_URLS)],
        postType: "devlog",
        status: "active",
        isDeleted: false,
        category: randomItem(CATEGORIES),
        tags: [randomItem(TAGS)],
        likes: [],
        commentsCount: randomInt(0, 20),
        views: randomInt(10, 1000),
        devlogStats: { status: "in-progress", phase: "development", progress: randomInt(10, 90) },
        createdAt: now
      });
    }

    await Job.insertMany(jobs);
    await Challenge.insertMany(challenges);
    await Codex.insertMany(codexes);
    await Artifact.insertMany(artifacts);
    await Post.insertMany(posts);

    console.log(`✅ Inserted 50 of each type for ${craftsmanInfo.name}`);
  }

  console.log("\n=========================================");
  console.log("🎉 ALL MULTIPLE CRAFTSMEN DATA SEEDED SUCCESSFULLY! 🎉");
  console.log("=========================================");
  process.exit(0);
}

seed().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
