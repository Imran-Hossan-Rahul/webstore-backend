// Quick test script to verify chat routes are working
import express from 'express';

const app = express();

// Test if chatRoutes can be imported
try {
  const chatRoutes = await import('./routes/chatRoutes.js');
  console.log('✅ Chat routes imported successfully');
  console.log('Available routes:', chatRoutes.default.stack?.map(r => r.route?.path) || 'Router OK');
} catch (error) {
  console.error('❌ Failed to import chat routes:', error.message);
  process.exit(1);
}

// Test if chatController can be imported
try {
  const chatController = await import('./controllers/chatController.js');
  console.log('✅ Chat controller imported successfully');
  console.log('Available functions:', Object.keys(chatController));
} catch (error) {
  console.error('❌ Failed to import chat controller:', error.message);
  process.exit(1);
}

// Test if Chat model can be imported
try {
  const Chat = await import('./models/Chat.model.js');
  console.log('✅ Chat model imported successfully');
} catch (error) {
  console.error('❌ Failed to import Chat model:', error.message);
  process.exit(1);
}

console.log('\n🎉 All chat system files are valid!');
console.log('Now restart your backend server with: npm run dev');
process.exit(0);
