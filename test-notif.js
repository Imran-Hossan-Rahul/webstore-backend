import { connectToDatabase } from './config/db.js';
import User from './models/User.model.js';
import { createBulkNotifications } from './controllers/notificationController.js';

async function run() {
  await connectToDatabase();
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }, '_id').lean();
  console.log("Admins found:", admins.length);
  
  if (admins.length > 0) {
    const adminIds = admins.map(a => a._id);
    try {
      const res = await createBulkNotifications(adminIds, {
         title: `Test Notification`,
         message: `Testing system`,
         type: 'order',
         actionUrl: `/admin`
      });
      console.log("createBulkNotifications result:", res);
    } catch (e) {
      console.error("Error calling createBulkNotifications:", e);
    }
  }
  process.exit(0);
}
run();
