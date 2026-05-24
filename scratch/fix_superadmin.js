import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const email = 'imranhossanrahul.dev@gmail.com';
    await User.findOneAndUpdate(
      { email },
      { isSuperAdmin: true }
    );
    
    console.log('SUCCESS: User is now a full SuperAdmin');
    
  } catch (error) {
    console.error('Error fixing superadmin:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixSuperAdmin();
