import { connectToDatabase } from './config/db.js';
import AbuseFlag from './models/AbuseFlag.model.js';
import MarketLicense from './models/MarketLicense.model.js';
import User from './models/User.model.js';

async function run() {
  try {
    await connectToDatabase();
    console.log("DB connected");

    const flags = await AbuseFlag.find({ status: 'open' })
        .populate({
          path: 'license_id',
          populate: { path: 'customer_id', select: 'name email' }
        })
        .sort({ severity: -1, createdAt: -1 });

    console.log("Flags:", flags.length);
  } catch (err) {
    console.error("Error in getAbuseFlags:", err);
  }
  process.exit(0);
}
run();
