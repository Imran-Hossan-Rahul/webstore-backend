import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // We'll define the model here because importing the real model might be tricky in a standalone script
    const userSchema = new mongoose.Schema({
      email: String,
      password: { type: String, select: false },
      passwordHistory: [String],
      role: String
    }, { collection: 'users' });
    
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    const email = 'imranhossanrahul.dev@gmail.com';
    const newPassword = 'Admin@123456';
    
    // Manual hashing because we aren't using the pre-save hook here (schema is partial)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const result = await User.findOneAndUpdate(
      { email },
      { 
        password: hashedPassword,
        passwordHistory: [hashedPassword] // Avoid validation error if they try to change it later
      },
      { new: true }
    );
    
    if (result) {
      console.log('SUCCESS: Password reset to Admin@123456');
    } else {
      console.log('ERROR: User not found');
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await mongoose.connection.close();
  }
}

resetPassword();
