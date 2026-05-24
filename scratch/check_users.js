import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const users = await User.find({}).select('name email role').limit(10);
    
    console.log('USER_LIST:');
    console.log(JSON.stringify(users, null, 2));
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkAdmins();
