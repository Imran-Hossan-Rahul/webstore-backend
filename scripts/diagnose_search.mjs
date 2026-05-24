// scripts/diagnose_search.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

console.log('\n🔍 SEARCH ANALYTICS DEEP DIVE:');
console.log('═'.repeat(60));

// 1. Show ALL search records with timestamps
const allSearches = await db.collection('searchAnalytics')
  .find({})
  .sort({ createdAt: -1 })
  .toArray();

console.log(`\nTotal records: ${allSearches.length}`);
console.log('\nAll search records:');
allSearches.forEach((s, i) => {
  const q = s.query?.original || s.query?.normalized || JSON.stringify(s.query);
  const clicked = s.interaction?.clickedResult;
  const clickPos = s.interaction?.clickPosition;
  console.log(`  ${i+1}. query="${q}" | clicked=${!!clicked} | clickPos=${clickPos ?? 'none'} | sessionId=${s.sessionId?.slice(-8)} | createdAt=${s.createdAt?.toISOString?.() || s.createdAt}`);
});

// 2. Group by query to see duplicates
const grouped = await db.collection('searchAnalytics').aggregate([
  { $group: {
    _id: '$query.original',
    count: { $sum: 1 },
    sessions: { $addToSet: '$sessionId' },
    visitors: { $addToSet: '$visitorId' },
    clicks: { $sum: { $cond: [{ $ifNull: ['$interaction.clickedResult', false] }, 1, 0] } }
  }},
  { $sort: { count: -1 } }
]).toArray();

console.log('\n\nGrouped by query:');
grouped.forEach(g => {
  console.log(`  "${g._id}": ${g.count} records, ${g.sessions.length} unique sessions, ${g.visitors.length} unique visitors, ${g.clicks} clicks`);
});

// 3. Check if tracking fires on every keystroke
// Look at time gaps between same query records
const nothingRecords = await db.collection('searchAnalytics')
  .find({ 'query.original': { $regex: /nothing/i } })
  .sort({ createdAt: 1 })
  .toArray();

if (nothingRecords.length > 1) {
  console.log('\n\nTime gaps for "nothing*" queries (ms between records):');
  for (let i = 1; i < nothingRecords.length; i++) {
    const gap = new Date(nothingRecords[i].createdAt) - new Date(nothingRecords[i-1].createdAt);
    const q1 = nothingRecords[i-1].query?.original;
    const q2 = nothingRecords[i].query?.original;
    console.log(`  "${q1}" → "${q2}": ${gap}ms gap`);
  }
}

// 4. Check CTR - how many have click interaction
const totalClicked = allSearches.filter(s => 
  s.interaction?.clickedResult || s.interaction?.clickPosition != null
).length;
console.log(`\n\nCTR Analysis:`);
console.log(`  Total searches: ${allSearches.length}`);
console.log(`  With click interaction: ${totalClicked}`);
console.log(`  CTR: ${allSearches.length > 0 ? ((totalClicked/allSearches.length)*100).toFixed(1) : 0}%`);

// Show interaction field of a sample
if (allSearches[0]) {
  console.log(`  Sample interaction field:`, JSON.stringify(allSearches[0].interaction));
  console.log(`  Sample results field:`, JSON.stringify(allSearches[0].results));
}

console.log('\n' + '═'.repeat(60));
await mongoose.disconnect();
process.exit(0);
