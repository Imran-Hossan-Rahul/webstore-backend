import mongoose from "mongoose";
import dotenv from "dotenv";
import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";

dotenv.config();

const testNotifications = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find first two users
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log("❌ Need at least 2 users in database");
      process.exit(1);
    }

    const [user1, user2] = users;
    console.log(`\n📧 Creating test notifications for ${user1.name} and ${user2.name}`);

    // Create test notifications
    const notifications = [
      {
        recipient: user1._id,
        sender: user2._id,
        type: "message",
        title: "New Message",
        message: `${user2.name} sent you a message`,
        link: `/inbox`
      },
      {
        recipient: user1._id,
        sender: user2._id,
        type: "follow",
        title: "New Follower",
        message: `${user2.name} started following you`,
        link: `/user/${user2._id}`
      },
      {
        recipient: user1._id,
        sender: user2._id,
        type: "like",
        title: "New Like",
        message: `${user2.name} liked your post`,
        link: `/templates/123`
      },
      {
        recipient: user2._id,
        sender: user1._id,
        type: "comment",
        title: "New Comment",
        message: `${user1.name} commented on your post`,
        link: `/templates/456`
      },
      {
        recipient: user2._id,
        type: "system",
        title: "Welcome!",
        message: "Welcome to our platform. Start exploring amazing templates!",
        link: `/`
      }
    ];

    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} test notifications`);

    // Show stats
    const user1Unread = await Notification.countDocuments({ recipient: user1._id, read: false });
    const user2Unread = await Notification.countDocuments({ recipient: user2._id, read: false });

    console.log(`\n📊 Notification Stats:`);
    console.log(`   ${user1.name}: ${user1Unread} unread notifications`);
    console.log(`   ${user2.name}: ${user2Unread} unread notifications`);

    console.log("\n✅ Test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

testNotifications();
