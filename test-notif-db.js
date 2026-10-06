import { connectToDatabase } from './config/db.js';
import Notification from './models/Notification.model.js';

async function run() {
  await connectToDatabase();
  const count = await Notification.countDocuments();
  console.log("Total notifications:", count);
  const recent = await Notification.find().sort({createdAt: -1}).limit(5).lean();
  console.log("Recent notifications:", JSON.stringify(recent, null, 2));
  process.exit(0);
}
run();
