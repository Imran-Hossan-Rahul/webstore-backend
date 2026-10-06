import mongoose from 'mongoose';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/codalina');
  const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }));
  const Chat = mongoose.model('Chat', new mongoose.Schema({}, { strict: false }));
  
  const chats = await Chat.find({ orderId: { $exists: true } }).lean();
  console.log('Order chats:', chats.length);
  
  if (chats.length > 0) {
    const chat = chats[chats.length - 1]; // latest
    console.log('Latest order chat:', chat._id);
    const msgs = await Message.find({ chatId: chat._id }).lean();
    console.log('Messages for latest order chat:', msgs.length);
    console.log(msgs.map(m => m.content));
  }
  process.exit(0);
}

check();
