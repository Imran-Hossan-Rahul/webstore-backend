import mongoose from 'mongoose';

const uri = "mongodb+srv://imranhossan:63qD77s4qO01L2yD@cluster0.b7wst.mongodb.net/codalina?retryWrites=true&w=majority";

const marketCategorySchema = new mongoose.Schema({}, { strict: false });
const MarketCategory = mongoose.models.MarketCategory || mongoose.model('MarketCategory', marketCategorySchema);

async function check() {
  try {
    await mongoose.connect(uri);
    const count = await MarketCategory.countDocuments();
    const all = await MarketCategory.find().lean();
    console.log(`Total categories: ${count}`);
    console.log(JSON.stringify(all.slice(0, 2), null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
