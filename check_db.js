import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB:", mongoose.connection.name);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name).join(', '));
    
    const productCount = await mongoose.connection.db.collection('marketproducts').countDocuments();
    const categoryCount = await mongoose.connection.db.collection('marketcategories').countDocuments();
    
    console.log("Products Count:", productCount);
    console.log("Categories Count:", categoryCount);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkDB();
