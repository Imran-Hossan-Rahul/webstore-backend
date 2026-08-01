import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
  name: String,
  role: String,
  profilePicture: String
});
const User = mongoose.model('User', UserSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/codalina");
  const admins = await User.find({ role: 'admin' });
  console.log(admins);
  process.exit(0);
}
check();
