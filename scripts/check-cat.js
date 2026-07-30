import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

const marketCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  isSubcategory: { type: Boolean, default: false },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketCategory' },
  isActive: { type: Boolean, default: true }
});
const MarketCategory = mongoose.models.MarketCategory || mongoose.model('MarketCategory', marketCategorySchema);

dotenv.config({ path: path.resolve('C:/Codalina/codalina-backend/.env') });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await MarketCategory.countDocuments();
    const all = await MarketCategory.find().lean();
    console.log(`Total categories: ${count}`);
    console.log(JSON.stringify(all, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
