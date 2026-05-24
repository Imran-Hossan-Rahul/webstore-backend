import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function promoteAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const email = 'imranhossanrahul.dev@gmail.com';
    const result = await User.findOneAndUpdate(
      { email },
      { role: 'superadmin' },
      { new: true }
    );
    
    if (result) {
      console.log('SUCCESS: User promoted to Superadmin');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('ERROR: User not found');
    }
    
  } catch (error) {
    console.error('Error promoting user:', error);
  } finally {
    await mongoose.connection.close();
  }
}

promoteAdmin();
