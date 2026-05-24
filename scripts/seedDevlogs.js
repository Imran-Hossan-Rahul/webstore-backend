import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import Comment from "../models/Comment.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const seedDevlogs = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // Get a couple of users
    const users = await User.find({}).limit(5);
    if (users.length === 0) {
      console.log("No users found in database. Please run seedSuperUser.js first.");
      process.exit(1);
    }
    
    const author = users[0];
    const collaboratorNames = users.map(u => u.username);
    console.log(`Using author: ${author.username}`);

    const devlogData = [
      {
        title: "Rebuilding our Frontend Architecture with Next.js 14",
        content: "## The Journey Begins\n\nWe realized our old CRA app was no longer cutting it. The bundle size was massive, and initial load times were hurting our SEO. In this devlog, I'll walk through our decision to migrate to Next.js 14 with the App Router.\n\n### Why Next.js?\nServer components are a game changer. We can finally ship less JavaScript to the client while keeping the interactivity where it matters.\n\nStay tuned for milestone updates as we migrate our core features.",
        postType: "devlog",
        category: "Frontend Architecture",
        tags: ["nextjs", "migration", "performance", "react"],
        views: 4500,
        likes: 340,
        devlogStats: {
          tools: ["Next.js 14", "React Server Components", "TailwindCSS"],
          timeSpent: "2 weeks",
          difficulty: "Advanced",
          location: "Remote",
          startDate: new Date("2025-01-10"),
          endDate: new Date("2025-03-15"),
          phase: "In Development",
          status: "In Progress",
          collaborators: collaboratorNames.slice(0, 3),
          license: "MIT",
          milestones: [
            { title: "Project Scoping", date: new Date("2025-01-10"), status: "completed", description: "Defined the migration strategy and analyzed current bundle." },
            { title: "Authentication Flow", date: new Date("2025-01-25"), status: "completed", description: "Migrated Auth.js to the new App Router structure." },
            { title: "Dashboard Rewrite", date: new Date("2025-02-15"), status: "in_progress", description: "Rewriting the main user dashboard with Server Components." },
            { title: "Launch MVP", date: new Date("2025-03-15"), status: "planned", description: "Go live with the new architecture for a subset of users." }
          ]
        }
      },
      {
        title: "Building a Real-time Collaborative Editor",
        content: "## Technical Challenges\n\nBuilding a real-time editor like Google Docs is incredibly complex. We are using Yjs for conflict resolution and WebSockets for real-time sync.\n\nThis devlog will document our approach to handling massive concurrent edits and cursor positions.",
        postType: "devlog",
        category: "Backend Scaling",
        tags: ["websockets", "yjs", "crdt", "realtime"],
        views: 8900,
        likes: 670,
        devlogStats: {
          tools: ["Node.js", "Socket.io", "Yjs", "Redis"],
          timeSpent: "1 month",
          difficulty: "Expert",
          location: "San Francisco",
          startDate: new Date("2024-11-01"),
          endDate: new Date("2025-01-20"),
          phase: "Completed",
          status: "Completed",
          collaborators: collaboratorNames.slice(1, 4),
          license: "Proprietary",
          milestones: [
            { title: "CRDT Implementation", date: new Date("2024-11-15"), status: "completed", description: "Successfully implemented Yjs for document state management." },
            { title: "WebSocket Scaling", date: new Date("2024-12-10"), status: "completed", description: "Scaled Socket.io using Redis adapters across 5 nodes." },
            { title: "Public Beta", date: new Date("2025-01-20"), status: "completed", description: "Opened the collaborative editor to our 10k beta testers." }
          ]
        }
      },
      {
        title: "Creating a Component Library from Scratch",
        content: "We decided to ditch Bootstrap and build our own internal UI kit. We needed something entirely custom to match our new brand guidelines.\n\nFollow along as we define our design tokens, build accessible primitives with Radix, and style them with Tailwind.",
        postType: "devlog",
        category: "UI/UX Restyle",
        tags: ["ui-kit", "design-system", "accessibility", "radix"],
        views: 3200,
        likes: 190,
        devlogStats: {
          tools: ["Radix UI", "TailwindCSS", "Storybook", "Figma"],
          timeSpent: "3 weeks",
          difficulty: "Intermediate",
          location: "London",
          startDate: new Date("2025-04-01"),
          endDate: new Date("2025-06-01"),
          phase: "Planning",
          status: "Planning",
          collaborators: [author.username],
          license: "Apache 2.0",
          milestones: [
            { title: "Figma Tokens", date: new Date("2025-04-05"), status: "completed", description: "Design team finalized all design tokens." },
            { title: "Core Primitives", date: new Date("2025-04-20"), status: "in_progress", description: "Building accessible buttons, inputs, and modals." },
            { title: "Storybook Integration", date: new Date("2025-05-15"), status: "planned", description: "Documenting components interactively." }
          ]
        }
      },
      {
        title: "Migrating from REST to GraphQL",
        content: "Our API payload sizes were getting out of hand, and mobile clients were suffering. We've officially decided to adopt GraphQL using Apollo Server.\n\nIn this series, we'll document schema design, resolver optimization, and the N+1 problem.",
        postType: "devlog",
        category: "Backend Architecture",
        tags: ["graphql", "apollo", "api", "optimization"],
        views: 12000,
        likes: 950,
        devlogStats: {
          tools: ["Apollo Server", "GraphQL", "Prisma", "TypeScript"],
          timeSpent: "2 months",
          difficulty: "Advanced",
          location: "Remote",
          startDate: new Date("2024-08-01"),
          endDate: new Date("2024-10-31"),
          phase: "Completed",
          status: "Completed",
          collaborators: collaboratorNames,
          license: "MIT",
          milestones: [
            { title: "Schema Design", date: new Date("2024-08-15"), status: "completed", description: "Drafted the entire GraphQL schema mapping to our relational DB." },
            { title: "Resolver Implementation", date: new Date("2024-09-15"), status: "completed", description: "Built resolvers and solved N+1 issues using DataLoader." },
            { title: "Client Migration", date: new Date("2024-10-31"), status: "completed", description: "Successfully swapped REST endpoints for GraphQL queries in our mobile app." }
          ]
        }
      },
      {
        title: "Automating Deployments with GitHub Actions",
        content: "No more manual deployments. We are building a robust CI/CD pipeline using GitHub Actions. It will handle linting, testing, Docker image building, and deploying to our Kubernetes cluster.",
        postType: "devlog",
        category: "DevOps",
        tags: ["ci-cd", "github-actions", "docker", "kubernetes"],
        views: 5400,
        likes: 420,
        devlogStats: {
          tools: ["GitHub Actions", "Docker", "Kubernetes", "Helm"],
          timeSpent: "1 week",
          difficulty: "Intermediate",
          location: "Berlin",
          startDate: new Date("2025-05-10"),
          endDate: new Date("2025-06-10"),
          phase: "In Development",
          status: "In Progress",
          collaborators: collaboratorNames.slice(0, 2),
          license: "None",
          milestones: [
            { title: "Test Pipeline", date: new Date("2025-05-12"), status: "completed", description: "Configured automated Jest testing on every PR." },
            { title: "Docker Registry", date: new Date("2025-05-20"), status: "in_progress", description: "Automated image builds and pushes to AWS ECR." },
            { title: "K8s Deployment", date: new Date("2025-06-05"), status: "planned", description: "Helm chart upgrades triggered automatically on merge to main." }
          ]
        }
      }
    ];

    console.log("Inserting Devlog Posts...");
    const createdDevlogs = [];
    for (const post of devlogData) {
      post.user = author._id;
      const newPost = await Post.create(post);
      createdDevlogs.push(newPost);
    }
    console.log(`Created ${createdDevlogs.length} devlogs.`);

    // Comments Generation
    const feedbackTypes = ['comment', 'issue', 'suggestion', 'kudos', 'question', 'answer', 'critique'];
    
    const sampleComments = [
      "This architecture change makes a lot of sense.",
      "Have you considered using tRPC instead of GraphQL?",
      "I noticed a potential memory leak in how you handle WebSockets.",
      "Brilliant approach! I'm going to steal this for my own project.",
      "How do you handle authentication in this new setup?",
      "The explanation here is top tier. Thanks for sharing.",
      "I'd recommend looking into Zustand instead of Redux for this specific use case.",
      "We tried this exact migration last year and ran into massive caching issues.",
      "Incredible progress on milestone 2! Keep it up.",
      "What happens if the CI/CD pipeline fails during the Helm upgrade?"
    ];

    const sampleReplies = [
      "Great point! I'll investigate that.",
      "We considered tRPC but our mobile team is strictly Apollo.",
      "Check out the follow-up post where we dive into auth.",
      "Thanks! Let me know if you run into any issues.",
      "That's a valid concern. We've added a rollback step in the Actions workflow.",
      "Yes, caching was a nightmare initially, but we solved it with Redis."
    ];

    let totalComments = 0;
    
    console.log("Generating 100+ comments with badges and replies...");

    for (const devlog of createdDevlogs) {
      const numComments = Math.floor(Math.random() * 15) + 20; // 20-35 comments per devlog
      
      const postComments = [];
      
      for (let i = 0; i < numComments; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const isReply = i > 4 && Math.random() > 0.6; // 40% chance to be a reply if we have some comments
        
        let parentId = null;
        if (isReply && postComments.length > 0) {
           const potentialParents = postComments.filter(c => !c.parentComment);
           if (potentialParents.length > 0) {
              parentId = potentialParents[Math.floor(Math.random() * potentialParents.length)]._id;
           }
        }

        const type = parentId ? (Math.random() > 0.5 ? 'answer' : 'comment') : feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)];
        const content = parentId ? sampleReplies[Math.floor(Math.random() * sampleReplies.length)] : sampleComments[Math.floor(Math.random() * sampleComments.length)];

        const comment = await Comment.create({
          content,
          post: devlog._id, // Notice we use 'post' here instead of 'artifact'
          author: randomUser._id,
          feedbackType: type,
          parentComment: parentId,
          likes: Math.floor(Math.random() * 50),
          isHelpful: type === 'answer' && Math.random() > 0.5
        });

        postComments.push(comment);
        totalComments++;
      }

      // Update Post with comments array
      devlog.comments = postComments.map(c => c._id);
      devlog.commentsCount = postComments.length;
      await devlog.save();
    }

    console.log(`Successfully generated ${totalComments} comments across ${createdDevlogs.length} devlogs.`);
    console.log("Devlog Demo data seeding complete!");
    process.exit(0);

  } catch (error) {
    console.error("Error seeding devlogs:", error);
    process.exit(1);
  }
};

seedDevlogs();
