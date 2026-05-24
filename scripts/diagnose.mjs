// scripts/diagnose.mjs - Run: node scripts/diagnose.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const collections = await db.listCollections().toArray();
const names = collections.map(c => c.name).sort();

console.log('\n📊 DATABASE COLLECTION COUNTS:');
console.log('═'.repeat(50));

for (const name of names) {
  const count = await db.collection(name).countDocuments();
  const flag = count === 0 ? ' ⚠️  EMPTY' : '';
  console.log(`  ${name.padEnd(35)} ${String(count).padStart(6)}${flag}`);
}

// Specific analytics checks
console.log('\n🔍 ANALYTICS DETAIL:');
console.log('═'.repeat(50));

// Check UserBehaviorEvent event types
try {
  const eventTypes = await db.collection('userbehaviorevents').aggregate([
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n  UserBehaviorEvent types:');
  if (eventTypes.length === 0) console.log('    (none)');
  eventTypes.forEach(e => console.log(`    ${e._id?.padEnd(30)} ${e.count}`));
} catch(e) { console.log('  userbehaviorevents: not found'); }

// Check SearchAnalytics sample
try {
  const sampleSearch = await db.collection('searchanalytics').findOne({});
  console.log('\n  SearchAnalytics sample:', sampleSearch ? JSON.stringify(Object.keys(sampleSearch)) : '(empty)');
} catch(e) {}

// Check Sessions
try {
  const sessions = await db.collection('sessions').countDocuments();
  const withPages = await db.collection('sessions').countDocuments({ pagesVisited: { $exists: true, $not: { $size: 0 } } });
  const withDuration = await db.collection('sessions').countDocuments({ duration: { $gt: 1000 } });
  console.log(`\n  Sessions total: ${sessions}`);
  console.log(`  Sessions with pagesVisited: ${withPages}`);
  console.log(`  Sessions with valid duration (>1s): ${withDuration}`);
} catch(e) {}

// Check Visitors
try {
  const visitors = await db.collection('visitors').countDocuments();
  const sample = await db.collection('visitors').findOne({});
  console.log(`\n  Visitors total: ${visitors}`);
  if (sample) console.log(`  Visitor fields: ${Object.keys(sample).join(', ')}`);
} catch(e) {}

// Check if tracking endpoints are being hit (check recent MouseMovements)
try {
  const recentMouse = await db.collection('mousemovements').findOne({}, { sort: { createdAt: -1 } });
  console.log(`\n  Last mouse event: ${recentMouse?.createdAt || 'none'}`);
} catch(e) {}

console.log('\n' + '═'.repeat(50));
console.log('✅ Diagnosis complete\n');
await mongoose.disconnect();
process.exit(0);
