import mongoose from 'mongoose';
import crypto from 'crypto';

const Schema = mongoose.Schema;

const JobSchema = new Schema({}, { strict: false });
const ChallengeSchema = new Schema({}, { strict: false });
const CodexSchema = new Schema({}, { strict: false });
const ArtifactSchema = new Schema({}, { strict: false });
const PostSchema = new Schema({}, { strict: false });
const UserSchema = new Schema({}, { strict: false });

const Job = mongoose.model('Job', JobSchema);
const Challenge = mongoose.model('Challenge', ChallengeSchema);
const Codex = mongoose.model('Codex', CodexSchema);
const Artifact = mongoose.model('Artifact', ArtifactSchema);
const Post = mongoose.model('Post', PostSchema);
const User = mongoose.model('User', UserSchema);

const MONGODB_URI = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];
const randomItems = (arr, count) => {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
const generateSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(4).toString('hex');

const categories = ["Frontend Development", "Backend Architecture", "Full Stack", "DevOps & Cloud", "AI & Machine Learning", "Mobile Development", "UI/UX Design", "Web3 & Blockchain"];
const skills = ["React", "Node.js", "Python", "TypeScript", "Next.js", "Docker", "AWS", "MongoDB", "GraphQL", "TailwindCSS", "Kubernetes", "PostgreSQL", "Go", "Rust"];
const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const cardShapes = ["square-small", "square-medium", "square-large", "rectangle-landscape", "rectangle-portrait"];
const genericImages = [
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1618477388954-7852f32655c7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80"
];

const generateJobs = (userId) => {
  return Array.from({ length: 50 }).map((_, i) => ({
    patron: userId,
    title: `[Demo] ${randomItem(["Build", "Refactor", "Design", "Deploy", "Optimize"])} a ${randomItem(["React", "Next.js", "Node.js", "Python", "AI"])} ${randomItem(["Dashboard", "API", "Mobile App", "Microservice", "E-commerce Site"])}`,
    description: "This is a demo job posting created for platform testing and demonstration purposes. We are looking for a talented developer to help us build a robust, scalable application. The ideal candidate has experience with modern web technologies and a strong understanding of system design. (Note: This is a placeholder description for showcasing the platform UI).",
    category: randomItem(categories),
    skills: randomItems(skills, randomInt(3, 6)),
    budget: {
      min: randomInt(500, 2000),
      max: randomInt(2500, 10000)
    },
    paymentType: randomItem(["fixed", "hourly"]),
    estimatedDuration: `${randomInt(1, 6)} months`,
    experienceLevel: randomItem(["junior", "intermediate", "expert"]),
    jobType: randomItem(["Full-time", "Contract", "Freelance"]),
    visibility: "public",
    status: "open",
    createdAt: new Date(Date.now() - randomInt(0, 30) * 86400000),
    tags: randomItems(skills, 3)
  }));
};

const generateChallenges = (userId) => {
  return Array.from({ length: 50 }).map((_, i) => ({
    title: `[Demo] ${randomItem(["Global", "Weekend", "Algorithm", "Frontend", "System Design"])} Hackathon: ${randomItem(["AI Integration", "Web3 DApp", "Performance Optimization", "UI Animation"])}`,
    description: "Welcome to this demo challenge! This is a test competition to showcase the platform's challenge and hackathon management capabilities. Participants are expected to build innovative solutions using cutting-edge technologies. (Note: This is demo data).",
    coverImage: randomItem(genericImages),
    category: randomItem(categories),
    difficulty: randomItem(difficulties),
    tags: randomItems(skills, 4),
    prize: `${randomInt(1, 5)}000 TKNS + Pro Subscription`,
    prizePool: randomInt(5000, 20000),
    payoutStatus: "pending",
    status: "published",
    startDate: new Date(Date.now() - randomInt(0, 10) * 86400000),
    endDate: new Date(Date.now() + randomInt(10, 30) * 86400000),
    brandColor: randomItem(["#4f46e5", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"]),
    judges: [userId],
    rules: ["Must use modern tech stack", "Code must be open source", "No plagiarism"],
    milestones: [
      { title: "Registration Opens", date: new Date(), status: "active" },
      { title: "Submission Deadline", date: new Date(Date.now() + 15 * 86400000), status: "upcoming" }
    ],
    judgingCriteria: [
      { criterion: "Innovation", weight: 30, description: "How unique is the solution?" },
      { criterion: "Technical Complexity", weight: 40, description: "Quality of code and architecture." },
      { criterion: "UI/UX", weight: 30, description: "Design and user experience." }
    ],
    createdAt: new Date()
  }));
};

const generateCodexes = (userId) => {
  return Array.from({ length: 50 }).map((_, i) => ({
    title: `[Demo] ${randomItem(["Advanced", "Ultimate Guide to", "Mastering", "Introduction to", "Deep Dive into"])} ${randomItem(["React 19", "Node.js Performance", "Microfrontends", "Serverless Architecture", "GraphQL APIs"])}`,
    slug: generateSlug(`demo-codex-${i}`),
    content: "<h2>Overview</h2><p>This is a highly detailed, comprehensive demo codex showcasing the platform's rich text capabilities, syntax highlighting, and content delivery system.</p><p>For testing purposes, this content is dynamically generated. Below you might find code snippets, diagrams, or best practices usually found in a high-quality engineering blog.</p>",
    excerpt: "This is a demo excerpt showcasing the Codex feed card. It includes a brief summary of the article's contents and highlights key takeaways for the reader...",
    author: userId,
    tags: randomItems(skills, 4),
    category: randomItem(categories),
    coverImage: randomItem(genericImages),
    cardShape: randomItem(cardShapes),
    subtitle: "A practical demo guide for testing",
    readTime: `${randomInt(3, 15)} min read`,
    isPublished: true,
    likesCount: randomInt(10, 500),
    commentsCount: randomInt(0, 50),
    views: randomInt(100, 5000),
    createdAt: new Date(Date.now() - randomInt(0, 60) * 86400000)
  }));
};

const generateArtifacts = (userId) => {
  return Array.from({ length: 50 }).map((_, i) => ({
    user: userId,
    title: `[Demo] ${randomItem(["E-Commerce Dashboard", "Chat UI Kit", "Authentication API", "Custom React Hooks", "Docker Dev Environment"])}`,
    slug: generateSlug(`demo-artifact-${i}`),
    sourceType: "upload",
    description: "A premium, production-ready demo artifact. This item is created to showcase the marketplace capabilities, including file downloads, preview rendering, and monetization features. Perfect for accelerating your next project.",
    tags: randomItems(skills, 3),
    tech: randomItems(skills, 3),
    category: randomItem(categories),
    cardShape: randomItem(cardShapes),
    priceType: randomItem(["free", "paid"]),
    price: randomInt(0, 100),
    currency: "TKNS",
    previewFile: randomItem(genericImages),
    fileUrl: "https://example.com/demo-file.zip",
    devlogFile: "demo-devlog.md",
    likeCount: randomInt(5, 200),
    impressionsCount: randomInt(50, 1000),
    createdAt: new Date(Date.now() - randomInt(0, 90) * 86400000)
  }));
};

const generatePosts = (userId) => {
  return Array.from({ length: 50 }).map((_, i) => ({
    user: userId,
    title: `[Demo Devlog] ${randomItem(["Day 1:", "Week 2 Update:", "Major Release:", "Bug Hunt:"])} ${randomItem(["Setting up the architecture", "Refactoring the database", "Implementing real-time sockets", "Polishing the UI"])}`,
    content: "Today I spent 8 hours completely rewriting the core logic of our main service. I realized that the previous approach was causing an N+1 query problem that would crash the app under load. \n\nHere's what I did:\n1. Added connection pooling\n2. Implemented Redis caching\n3. Optimized the MongoDB aggregations.\n\nThis is a demo devlog post for testing the feed.",
    images: Math.random() > 0.5 ? [randomItem(genericImages)] : [],
    likes: Array.from({length: randomInt(0, 20)}).map(()=> new mongoose.Types.ObjectId()),
    comments: [],
    createdAt: new Date(Date.now() - randomInt(0, 10) * 86400000)
  }));
};

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    console.log('Fetching user...');
    // Try to find Imran's account or use any admin/user available
    let user = await User.findOne({ email: /imran/i }) || await User.findOne();
    if (!user) {
       console.log('No user found! Creating a dummy user.');
       user = await User.create({ name: 'Demo User', email: 'demo@example.com', role: 'admin' });
    }
    const userId = user._id;
    console.log(`Using User ID: ${userId} (${user.name || user.email})`);

    console.log('Generating data arrays...');
    const jobs = generateJobs(userId);
    const challenges = generateChallenges(userId);
    const codexes = generateCodexes(userId);
    const artifacts = generateArtifacts(userId);
    const posts = generatePosts(userId);

    console.log('Inserting Jobs...');
    await Job.insertMany(jobs);
    
    console.log('Inserting Challenges...');
    await Challenge.insertMany(challenges);
    
    console.log('Inserting Codexes...');
    await Codex.insertMany(codexes);
    
    console.log('Inserting Artifacts...');
    await Artifact.insertMany(artifacts);
    
    console.log('Inserting Devlogs (Posts)...');
    await Post.insertMany(posts);

    console.log('\n=========================================');
    console.log('✅ SEEDING COMPLETE!');
    console.log(`✅ 50 Jobs inserted`);
    console.log(`✅ 50 Challenges inserted`);
    console.log(`✅ 50 Codexes inserted`);
    console.log(`✅ 50 Artifacts inserted`);
    console.log(`✅ 50 Devlogs (Posts) inserted`);
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
