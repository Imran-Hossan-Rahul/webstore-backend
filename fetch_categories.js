import mongoose from 'mongoose';
import MarketCategory from './models/MarketCategory.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const categories = await MarketCategory.find({ isSubcategory: true });
  categories.forEach(c => console.log(c.name));
  process.exit(0);
}
run();
