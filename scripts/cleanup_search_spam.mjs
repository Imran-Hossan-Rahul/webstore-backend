import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SearchAnalyticsSchema = new mongoose.Schema({
  query: {
    original: String,
    normalized: String
  }
}, { strict: false });

const SearchAnalytics = mongoose.model('SearchAnalytics', SearchAnalyticsSchema, 'searchAnalytics');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Remove duplicates where count is high but actually it's just spam
    // For "fd" and "nothingg", we'll just keep the 1st one for each session or just keep a few
    
    const targetQueries = ['fd', 'nothingg'];
    
    for (const q of targetQueries) {
      const count = await SearchAnalytics.countDocuments({ 'query.normalized': q.toLowerCase() });
      console.log(`Found ${count} entries for "${q}"`);
      
      if (count > 5) {
        // Keep only the 5 most recent ones to preserve some real data but remove the spam
        const toKeep = await SearchAnalytics.find({ 'query.normalized': q.toLowerCase() })
          .sort({ 'context.timestamp': -1 })
          .limit(5)
          .select('_id');
        
        const idsToKeep = toKeep.map(doc => doc._id);
        
        const result = await SearchAnalytics.deleteMany({
          'query.normalized': q.toLowerCase(),
          _id: { $nin: idsToKeep }
        });
        
        console.log(`Deleted ${result.deletedCount} spam entries for "${q}"`);
      }
    }

    await mongoose.disconnect();
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Error:', error);
  }
}

cleanup();
