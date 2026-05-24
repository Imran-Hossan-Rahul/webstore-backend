import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Post from '../models/Post.model.js';
import Comment from '../models/Comment.model.js';
import User from '../models/User.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];
const randomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const techStacks = ["React", "Next.js", "Node.js", "Express", "MongoDB", "PostgreSQL", "Redis", "Docker", "Kubernetes", "AWS", "Figma", "TailwindCSS", "TypeScript", "GraphQL", "Python", "Rust", "Go"];
const categories = ["Frontend", "Backend", "Full Stack", "DevOps", "Design", "Architecture"];
const devlogTags = ["update", "refactor", "bugfix", "feature", "milestone", "release", "planning"];
const licenses = ["MIT", "Apache 2.0", "GPL v3", "Proprietary", "None"];
const locations = ["Remote", "New York", "London", "San Francisco", "Berlin"];

const feedbackTypes = ['comment', 'issue', 'suggestion', 'kudos', 'question', 'answer', 'critique'];

const commentTemplates = {
  comment: ["This looks really solid.", "Interesting approach to the problem.", "Looking forward to seeing more updates.", "I've been following this, great work so far.", "Can't wait to see the final product.", "The architecture choices make a lot of sense."],
  issue: ["I noticed a bug when trying to run this locally, the build fails on step 2.", "Is there a memory leak in the connection pool? I saw high usage.", "The UI seems to break on mobile screens for the dashboard.", "I found a typo in the documentation link.", "The authentication middleware seems to bypass the token check in edge cases."],
  suggestion: ["Have you considered using Redis for caching the queries?", "You might want to extract that logic into a separate hook.", "Adding some unit tests for the core logic would be great.", "Maybe you could use Tailwind for faster styling here?", "I recommend implementing rate limiting on that API endpoint."],
  kudos: ["Absolutely amazing work!", "This is a masterpiece of engineering.", "Great job on hitting the milestone early!", "Love the design and attention to detail.", "You're a wizard, this saved me so much time!", "This is incredibly well written."],
  question: ["How did you handle the state management for the complex forms?", "Why did you choose PostgreSQL over MongoDB for this specific feature?", "Are you planning to open-source this?", "What is the timeline for the next milestone?", "Could you elaborate on how the WebSockets are scaled?"],
  answer: ["I actually solved a similar issue by using a custom hook.", "You can fix that by upgrading to the latest version.", "The documentation says to configure the ENV variables first.", "Yes, it will be open-sourced soon.", "The WebSockets scale via Redis pub/sub."],
  critique: ["The initial load time seems a bit slow, it could be optimized.", "I think the UI is a bit cluttered right now.", "The code could be cleaner if you used more functional programming concepts.", "The error handling could be more robust.", "I feel like the database schema is slightly over-engineered for this use case."]
};

async function createDummyUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const name = `DemoUser${crypto.randomBytes(4).toString('hex')}`;
    users.push({
      name: name,
      email: `${name}@example.com`,
      password: "P@ssw0rd123!", // Updated to meet strict validation
      role: "user",
      username: name
    });
  }
  return await User.insertMany(users);
}

async function enrichDevlogs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    // Fix malformed 'likes' data inserted by seedDemoData.js before fetching
    console.log('Cleaning up malformed likes data in existing posts...');
    await Post.collection.updateMany(
      { likes: { $type: "array" } },
      [ { $set: { likedBy: "$likes", likes: { $size: "$likes" } } } ]
    );

    // Fetch existing demo devlogs
    console.log('Fetching existing Demo Devlogs...');
    const devlogs = await Post.find({ title: /\[Demo Devlog\]/i });
    
    if (devlogs.length === 0) {
      console.log('No demo devlogs found. Please run seedDemoData.js first.');
      process.exit(0);
    }

    console.log(`Found ${devlogs.length} demo devlogs. Proceeding to enrich...`);

    // Ensure we have dummy users for comments and team
    let dummyUsers = await User.find({ email: /@example\.com/ });
    if (dummyUsers.length < 50) {
      console.log('Creating additional dummy users for rich interactions...');
      const newUsers = await createDummyUsers(50 - dummyUsers.length);
      dummyUsers = [...dummyUsers, ...newUsers];
    }
    const userIds = dummyUsers.map(u => u._id);
    const userNames = dummyUsers.map(u => u.name);

    let totalCommentsCreated = 0;
    const allCommentsToInsert = [];

    for (let i = 0; i < devlogs.length; i++) {
      const devlog = devlogs[i];
      
      // Update basic fields
      devlog.postType = "devlog";
      devlog.category = randomItem(categories);
      devlog.tags = randomItems(devlogTags, randomInt(2, 4));
      
      // Update devlogStats
      const startDate = new Date(Date.now() - randomInt(30, 90) * 86400000);
      const endDate = new Date(Date.now() + randomInt(30, 90) * 86400000);
      
      devlog.devlogStats = {
        tools: randomItems(techStacks, randomInt(3, 6)),
        timeSpent: `${randomInt(10, 100)} hours`,
        devlogLink: "https://github.com/demo/project",
        difficulty: randomItem(["Beginner", "Intermediate", "Advanced", "Expert"]),
        location: randomItem(locations),
        startDate: startDate,
        endDate: endDate,
        originalEndDate: new Date(endDate.getTime() - randomInt(5, 15) * 86400000),
        phase: randomItem(["Planning", "In Development", "Live"]),
        status: randomItem(["In Progress", "Completed"]),
        livePreviewUrl: "https://demo.codalina.com",
        documentationUrl: "https://docs.codalina.com",
        collaborators: randomItems(userNames, randomInt(2, 5)),
        license: randomItem(licenses),
        milestones: [
          { title: "Project Kickoff", date: new Date(startDate.getTime() + 86400000), status: "completed", description: "Initial setup and architecture design." },
          { title: "Core MVP", date: new Date(startDate.getTime() + 15 * 86400000), status: "completed", description: "Basic features functional." },
          { title: "Beta Release", date: new Date(Date.now() + 5 * 86400000), status: "in_progress", description: "Gathering user feedback." },
          { title: "v1.0 Launch", date: endDate, status: "planned", description: "Public release." }
        ],
        extensions: [
          { newDate: endDate, reason: "Additional testing required for mobile responsiveness." }
        ],
        updateReasons: [
          { reason: "Refactored the authentication flow." }
        ],
        activityLog: [
          { type: "create", action: "Project Started", details: "Initialized repository and defined scope." },
          { type: "milestone", action: "MVP Reached", details: "Core functionalities are now working." }
        ]
      };

      // Generate minimum 100 comments
      const numComments = randomInt(105, 130);
      const devlogComments = [];
      const parentCommentIds = [];

      for (let j = 0; j < numComments; j++) {
        const type = randomItem(feedbackTypes);
        const content = randomItem(commentTemplates[type]) + (Math.random() > 0.5 ? ` Also, ${randomItem(commentTemplates['suggestion']).toLowerCase()}` : '');
        
        // 30% chance to be a reply to an existing comment (if any exist)
        let parentId = null;
        if (parentCommentIds.length > 0 && Math.random() < 0.3) {
          parentId = randomItem(parentCommentIds);
        }

        const commentId = new mongoose.Types.ObjectId();

        allCommentsToInsert.push({
          _id: commentId,
          content: content,
          post: devlog._id,
          author: randomItem(userIds),
          feedbackType: type,
          parentComment: parentId,
          isPinned: j === 0 ? true : false, // Pin the first comment
          isHelpful: Math.random() > 0.8,
          likes: randomInt(0, 50),
          createdAt: new Date(Date.now() - randomInt(0, 30) * 86400000)
        });

        devlogComments.push(commentId);
        
        if (!parentId) {
           parentCommentIds.push(commentId); // Only allow replying to top-level comments for simplicity
        }
      }

      devlog.comments = [...devlog.comments, ...devlogComments];
      devlog.commentsCount = devlog.comments.length;
      
      totalCommentsCreated += devlogComments.length;
    }

    console.log(`Bulk inserting ${allCommentsToInsert.length} comments...`);
    await Comment.insertMany(allCommentsToInsert);
    
    console.log('Bulk saving devlogs...');
    await Promise.all(devlogs.map(d => d.save()));

    console.log('\n=========================================');
    console.log('✅ ENRICHMENT COMPLETE!');
    console.log(`✅ ${devlogs.length} Devlogs successfully updated with rich data.`);
    console.log(`✅ ${totalCommentsCreated} Comments generated with multiple badges and replies.`);
    console.log('=========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('Error enriching demo devlogs:', error);
    process.exit(1);
  }
}

enrichDevlogs();
