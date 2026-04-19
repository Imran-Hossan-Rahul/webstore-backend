import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Models
import Activity from "../models/Activity.model.js";
import Challenge from "../models/Challenge.model.js";
import Chat from "../models/Chat.model.js";
import CollaborationRoom from "../models/CollaborationRoom.model.js";
import Comment from "../models/Comment.model.js";
import CommunityTask from "../models/CommunityTask.model.js";
import CreatorProfile from "../models/CreatorProfile.model.js";
import Discussion from "../models/Discussion.model.js";
import Event from "../models/Event.js";
import Follow from "../models/Follow.model.js";
import FollowHistory from "../models/FollowHistory.model.js";
import Job from "../models/Job.model.js";
import Notification from "../models/Notification.model.js";
import Payout from "../models/Payout.model.js";
import PlatformProfile from "../models/PlatformProfile.model.js";
import Post from "../models/Post.model.js";
import RefreshToken from "../models/RefreshToken.model.js";
import Resource from "../models/Resource.model.js";
import Sale from "../models/Sale.model.js";
import Session from "../models/Session.js";
import Template from "../models/Template.model.js";
import Transaction from "../models/Transaction.model.js";
import User from "../models/User.model.js";
import Visitor from "../models/Visitor.js";
import Blog from "../models/blog.model.js";

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const wipeData = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const models = [
      { name: "Activity", model: Activity },
      { name: "Challenge", model: Challenge },
      { name: "Chat", model: Chat },
      { name: "CollaborationRoom", model: CollaborationRoom },
      { name: "Comment", model: Comment },
      { name: "CommunityTask", model: CommunityTask },
      { name: "CreatorProfile", model: CreatorProfile },
      { name: "Discussion", model: Discussion },
      { name: "Event", model: Event },
      { name: "Follow", model: Follow },
      { name: "FollowHistory", model: FollowHistory },
      { name: "Job", model: Job },
      { name: "Notification", model: Notification },
      { name: "Payout", model: Payout },
      { name: "PlatformProfile", model: PlatformProfile },
      { name: "Post", model: Post },
      { name: "RefreshToken", model: RefreshToken },
      { name: "Resource", model: Resource },
      { name: "Sale", model: Sale },
      { name: "Session", model: Session },
      { name: "Template", model: Template },
      { name: "Transaction", model: Transaction },
      { name: "User", model: User },
      { name: "Visitor", model: Visitor },
      { name: "Blog", model: Blog },
    ];

    console.log("Starting data wipe...");

    for (const { name, model } of models) {
      if (model && model.deleteMany) {
        await model.deleteMany({});
        console.log(`Cleared collection: ${name}`);
      } else {
         console.warn(`Skipping ${name}: Model not found or deleteMany not available`);
      }
    }

    console.log("All data wiped successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error wiping data:", error);
    process.exit(1);
  }
};

wipeData();
