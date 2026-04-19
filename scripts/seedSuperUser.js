import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import User from "../models/User.model.js";

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const seedSuperUser = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const superUserEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@example.com";
    const superUserPassword = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin123!@#";

    if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
        console.warn("\n⚠️  WARNING: Using default credentials because SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD are not set in .env");
        console.warn(`Using Email: ${superUserEmail}`);
        console.warn(`Using Password: ${superUserPassword}\n`);
    }

    let user = await User.findOne({ email: superUserEmail });

    if (user) {
      console.log("User found. Updating to Super Admin...");
      user.isSuperAdmin = true;
      user.role = "admin";
      user.isActive = true;
      user.emailVerified = true;
      // Optionally update password if you want to reset it every time
      // user.password = superUserPassword; 
      // But usually, we might want to keep the existing password if known.
      // Let's explicitly set it if it's a "seed" script to ensure access.
      user.password = superUserPassword;
      
      await user.save();
      console.log(`User ${superUserEmail} updated to Super Admin.`);
    } else {
      console.log("User not found. Creating Super Admin...");
      user = new User({
        name: "Super Admin",
        email: superUserEmail,
        password: superUserPassword,
        role: "admin",
        isSuperAdmin: true,
        isActive: true,
        emailVerified: true,
        hasCompletedOnboarding: true,
      });

      await user.save();
      console.log(`Super Admin created: ${superUserEmail}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding super user:", error);
    process.exit(1);
  }
};

seedSuperUser();
