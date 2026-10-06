import { connectToDatabase } from './config/db.js';
import MarketLicense from './models/MarketLicense.model.js';
import MarketProduct from './models/MarketProduct.model.js';
import User from './models/User.model.js';
import MarketOrder from './models/MarketOrder.model.js';

async function run() {
  try {
    await connectToDatabase();
    console.log("DB connected");
    const count = await MarketLicense.countDocuments();
    console.log("Total MarketLicenses:", count);

    const sample = await MarketLicense.find().limit(1)
      .populate('order_id')
      .populate('customer_id', 'name email')
      .populate('product_id', 'title');
      
    console.log("Sample License:", JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
