import mongoose from "mongoose";
import User from "../models/User.model.js";
import { generateUniqueUsername } from "../utils/generateUsername.js";
import dotenv from "dotenv";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for migration...");

    const usersWithoutUsername = await User.find({ 
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" }
      ]
    });

    console.log(`Found ${usersWithoutUsername.length} users needing usernames.`);

    for (const user of usersWithoutUsername) {
      const username = await generateUniqueUsername(user.name, User);
      user.username = username;
      await user.save();
      console.log(`Updated user: ${user.name} -> ${username}`);
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
