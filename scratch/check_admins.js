import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkAdmins() {
  try {
    if (!process.env.MONGODB_URI) {
       console.error('MONGODB_URI not found in env');
       process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const admins = await User.find({ 
      role: { $in: ['admin', 'superadmin'] } 
    }).select('name email role');
    
    console.log('ADMIN_CHECK_RESULTS:');
    console.log(JSON.stringify(admins, null, 2));
    
  } catch (error) {
    console.error('Error checking admins:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkAdmins();
