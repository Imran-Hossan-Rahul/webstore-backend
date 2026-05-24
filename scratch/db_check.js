import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;

async function check() {
  try {
    console.log("Connecting to:", uri.split("@")[1] || uri);
    await mongoose.connect(uri);
    console.log("✅ Connected!");
    console.log("Database Name:", mongoose.connection.db.databaseName);

    // Find the user
    const usersCollection = mongoose.connection.db.collection("users");
    const user = await usersCollection.findOne({ email: "imranhossanrahul.dev@gmail.com" });
    if (user) {
      console.log("🎉 User Found!");
      console.log("User ID:", user._id.toString());
      console.log("User Name:", user.name);
    } else {
      console.log("❌ User not found with email 'imranhossanrahul.dev@gmail.com'");
      const allUsers = await usersCollection.find({}).limit(5).toArray();
      console.log("Sample Users in DB:", allUsers.map(u => ({ name: u.name, email: u.email })));
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

check();
