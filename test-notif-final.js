import { connectToDatabase } from './config/db.js';
import User from './models/User.model.js';
import Notification from './models/Notification.model.js';
import { createBulkNotifications } from './controllers/notificationController.js';

async function run() {
  await connectToDatabase();
  console.log("DB Connected.");
  
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }, '_id').lean();
  console.log(`Found ${admins.length} admins`);
  
  if (admins.length > 0) {
    const adminIds = admins.map(a => a._id);
    
    console.log("Test 1: Direct Mongoose Insert");
    try {
      const doc = await Notification.create({
        recipient: adminIds[0],
        title: "Test Order Direct",
        message: "Testing mongoose enum",
        type: "order"
      });
      console.log("Direct insert SUCCESS, ID:", doc._id);
    } catch (e) {
      console.error("Direct insert FAILED:", e.message);
    }

    console.log("\nTest 2: createBulkNotifications");
    try {
      const res = await createBulkNotifications(adminIds, {
         title: `Test Order Bulk`,
         message: `Testing bulk function`,
         type: 'order',
         actionUrl: `/admin/orders`
      });
      console.log("createBulkNotifications SUCCESS:", res);
    } catch (e) {
      console.error("createBulkNotifications FAILED:", e.message);
    }
  }
  process.exit(0);
}
run();
