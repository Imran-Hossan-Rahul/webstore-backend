require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ username: String, profilePicture: String, role: String }));
  const u = await User.findOne({ profilePicture: { $ne: '' } });
  console.log('User:', u);
  process.exit(0);
});
