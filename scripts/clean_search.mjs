import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const res = await db.collection('searchAnalytics').deleteMany({ 
    'query.original': { $regex: /nothing|so/i } 
  });
  console.log('Cleaned up buggy records:', res.deletedCount);
  await mongoose.disconnect();
}
clean();
