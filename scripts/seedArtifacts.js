import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import User from "../models/User.model.js";
import Artifact from "../models/Artifact.model.js";
import Comment from "../models/Comment.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const seedArtifacts = async () => {
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
    console.log(`Using author: ${author.username}`);

    const artifactsData = [
      {
        title: "Nexus React Admin Dashboard",
        description: "A highly customizable and responsive admin dashboard template built with React, Tailwind CSS, and Framer Motion. Features dark mode, real-time charts, and advanced authentication flows.",
        tags: ["dashboard", "admin", "react", "tailwind"],
        tech: ["React", "TailwindCSS", "Framer Motion", "Recharts"],
        category: "Admin Dashboard",
        cardShape: "banner-wide",
        priceType: "paid",
        price: 49,
        previewFile: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
        devlogFile: "nexus-admin-docs.pdf",
        versions: [
          { version: "v1.0.0", changelog: "Initial Release" },
          { version: "v1.1.0", changelog: "Added Dark Mode and Framer Motion animations" },
          { version: "v1.2.0", changelog: "Performance optimization and bug fixes" }
        ],
        currentVersion: "v1.2.0",
        viewsCount: 15420,
        downloadsCount: 342,
        likeCount: 1205,
        averageRating: 4.8,
        ratingCount: 156,
        popular: true,
        trending: true,
      },
      {
        title: "Aura E-Commerce UI Kit",
        description: "Premium UI kit for modern e-commerce platforms. Includes 50+ pre-built components, product pages, checkout flows, and user profiles. Built specifically for Next.js.",
        tags: ["ecommerce", "ui-kit", "shop", "nextjs"],
        tech: ["Next.js", "TypeScript", "TailwindCSS"],
        category: "eCommerce",
        cardShape: "square-medium",
        priceType: "paid",
        price: 99,
        previewFile: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80",
        devlogFile: "aura-ecommerce.zip",
        versions: [{ version: "v1.0.0", changelog: "First launch" }],
        viewsCount: 8900,
        downloadsCount: 120,
        likeCount: 890,
        averageRating: 4.9,
        ratingCount: 88,
        popular: true,
      },
      {
        title: "Fluid Animations Library",
        description: "A lightweight, hardware-accelerated animation library for React applications. Drop-in replacement for standard CSS transitions with zero configuration required.",
        tags: ["animation", "library", "react", "performance"],
        tech: ["React", "WebGL", "GSAP"],
        category: "Animation",
        cardShape: "square-small",
        priceType: "free",
        price: 0,
        previewFile: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
        devlogFile: "fluid-animations-source.zip",
        versions: [
          { version: "v2.0.0", changelog: "Complete rewrite in TypeScript" },
          { version: "v2.1.0", changelog: "Added scroll-trigger support" }
        ],
        currentVersion: "v2.1.0",
        viewsCount: 25400,
        downloadsCount: 12500,
        likeCount: 3400,
        averageRating: 4.7,
        ratingCount: 450,
        editorsChoice: true,
        trending: true,
      },
      {
        title: "Stratos Landing Page Builder",
        description: "Drag and drop landing page builder for SaaS startups. Generate clean React code instantly. Includes 20+ conversion-optimized templates.",
        tags: ["landing-page", "saas", "builder", "generator"],
        tech: ["React", "Redux", "TailwindCSS", "Node.js"],
        category: "Site Artifacts",
        cardShape: "rectangle-horizontal",
        priceType: "paid",
        price: 149,
        previewFile: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
        devlogFile: "stratos-builder-pro.zip",
        versions: [{ version: "v1.0.0", changelog: "Initial Beta" }],
        viewsCount: 5400,
        downloadsCount: 45,
        likeCount: 430,
        averageRating: 4.5,
        ratingCount: 32,
      },
      {
        title: "Quantum Authentication Components",
        description: "Secure, beautiful, and accessible authentication components. Includes login, signup, password reset, and magic link flows. Supports OAuth providers natively.",
        tags: ["auth", "security", "components", "login"],
        tech: ["React", "TailwindCSS", "NextAuth"],
        category: "Components",
        cardShape: "rectangle-vertical",
        priceType: "free",
        price: 0,
        previewFile: "https://images.unsplash.com/photo-1555949963-aa79dcee57d5?auto=format&fit=crop&w=800&q=80",
        devlogFile: "quantum-auth.zip",
        versions: [{ version: "v1.5.0", changelog: "Added Magic Link support" }],
        viewsCount: 12000,
        downloadsCount: 8900,
        likeCount: 2100,
        averageRating: 4.9,
        ratingCount: 310,
        popular: true,
      }
    ];

    console.log("Inserting Artifacts...");
    const createdArtifacts = [];
    for (const art of artifactsData) {
      art.user = author._id;
      const newArt = await Artifact.create(art);
      createdArtifacts.push(newArt);
    }
    console.log(`Created ${createdArtifacts.length} artifacts.`);

    // Comments Generation
    const feedbackTypes = ['comment', 'issue', 'suggestion', 'kudos', 'question', 'answer', 'critique'];
    
    const sampleComments = [
      "This is exactly what I was looking for! Amazing work.",
      "Can we get TypeScript support in the next version?",
      "I found a small bug on mobile view when opening the modal.",
      "The documentation is really clear and helpful.",
      "How do I integrate this with Next.js App Router?",
      "Absolutely brilliant piece of engineering.",
      "Consider adding dark mode support, it would make this perfect.",
      "I've been using this in production for 3 months now without a single issue.",
      "The performance improvements in v2 are massive!",
      "Is there a roadmap for future features?"
    ];

    const sampleReplies = [
      "I agree completely!",
      "I've added this to the backlog for the next update.",
      "Check the docs under 'Advanced Configuration', it explains this.",
      "Thanks for the feedback!",
      "I encountered the same thing, temporary fix is adding overflow-hidden.",
      "Will be resolved in v2.2.0."
    ];

    let totalComments = 0;
    
    console.log("Generating 100+ comments with badges and replies...");

    for (const artifact of createdArtifacts) {
      const numComments = Math.floor(Math.random() * 15) + 15; // 15-30 comments per artifact
      
      const artifactComments = [];
      
      for (let i = 0; i < numComments; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const isReply = i > 3 && Math.random() > 0.6; // 40% chance to be a reply if we have some comments
        
        let parentId = null;
        if (isReply && artifactComments.length > 0) {
           const potentialParents = artifactComments.filter(c => !c.parentComment);
           if (potentialParents.length > 0) {
              parentId = potentialParents[Math.floor(Math.random() * potentialParents.length)]._id;
           }
        }

        const type = parentId ? (Math.random() > 0.5 ? 'answer' : 'comment') : feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)];
        const content = parentId ? sampleReplies[Math.floor(Math.random() * sampleReplies.length)] : sampleComments[Math.floor(Math.random() * sampleComments.length)];

        const comment = await Comment.create({
          content,
          artifact: artifact._id,
          author: randomUser._id,
          feedbackType: type,
          parentComment: parentId,
          likes: Math.floor(Math.random() * 50),
          isHelpful: type === 'answer' && Math.random() > 0.5
        });

        artifactComments.push(comment);
        totalComments++;
      }

      // Update Artifact with comments array
      artifact.comments = artifactComments.map(c => c._id);
      artifact.commentsCount = artifactComments.length;
      await artifact.save();
    }

    console.log(`Successfully generated ${totalComments} comments across ${createdArtifacts.length} artifacts.`);
    console.log("Demo data seeding complete!");
    process.exit(0);

  } catch (error) {
    console.error("Error seeding artifacts:", error);
    process.exit(1);
  }
};

seedArtifacts();
