// scripts/diagnose2.mjs - Deep event analysis
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

console.log('\n🔬 DEEP EVENT TYPE ANALYSIS:');
console.log('═'.repeat(60));

// 1. UserBehaviorEvent types
const ubTypes = await db.collection('userBehaviorEvents').aggregate([
  { $group: { _id: '$eventType', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log('\n  userBehaviorEvents event types (total 9168 docs):');
ubTypes.forEach(e => console.log(`    "${e._id}"`.padEnd(40) + e.count));

// 2. Check a sample UserBehaviorEvent document
const ubSample = await db.collection('userBehaviorEvents').findOne({});
console.log('\n  Sample userBehaviorEvent keys:', ubSample ? Object.keys(ubSample) : 'NONE');
if (ubSample) console.log('  Sample eventType:', ubSample.eventType);

// 3. SearchAnalytics - why 8 docs but shows 0?
const searchSample = await db.collection('searchAnalytics').findOne({});
console.log('\n  SearchAnalytics sample keys:', searchSample ? Object.keys(searchSample) : 'NONE');
console.log('  SearchAnalytics count:', await db.collection('searchAnalytics').countDocuments());

// 4. Session Replay collection name check
const srpCount = await db.collection('sessionReplays').countDocuments();
const srpSample = await db.collection('sessionReplays').findOne({});
console.log('\n  sessionReplays:', srpCount, 'docs');
console.log('  Sample keys:', srpSample ? Object.keys(srpSample) : 'NONE');

// 5. Advanced stats - what the endpoint actually queries
console.log('\n\n📊 WHAT getAdvancedStats QUERIES vs ACTUAL DB:');
console.log('═'.repeat(60));

// Mouse: { eventType: { $in: ['click', 'rage_click', ...] } }
const mouseFromEvents = await db.collection('userBehaviorEvents').countDocuments({ 
  eventType: { $in: ['click', 'rage_click', 'double_click', 'right_click'] } 
});
const mouseFromMovements = await db.collection('mouseMovements').countDocuments();
console.log(`\n  Mouse events (from userBehaviorEvents click types): ${mouseFromEvents}`);
console.log(`  Mouse movements (from mouseMovements collection):   ${mouseFromMovements}`);

// Keystroke
const keystrokeFromEvents = await db.collection('userBehaviorEvents').countDocuments({ eventType: 'keystroke' });
const keystrokeFromTimings = await db.collection('keystrokeTimings').countDocuments();
console.log(`\n  Keystroke (from userBehaviorEvents 'keystroke'):    ${keystrokeFromEvents}`);
console.log(`  KeystrokeTimings (from keystrokeTimings):           ${keystrokeFromTimings}`);

// Clipboard
const clipboardFromEvents = await db.collection('userBehaviorEvents').countDocuments({ 
  eventType: { $in: ['copy', 'paste', 'clipboard'] } 
});
const clipboardFromCol = await db.collection('clipboardActivities').countDocuments();
console.log(`\n  Clipboard (from userBehaviorEvents):                ${clipboardFromEvents}`);
console.log(`  ClipboardActivities (from clipboardActivities):     ${clipboardFromCol}`);

// Tab
const tabFromEvents = await db.collection('userBehaviorEvents').countDocuments({ 
  eventType: { $in: ['page_blur', 'page_focus', 'tab_activity'] } 
});
const tabFromCol = await db.collection('tabActivities').countDocuments();
console.log(`\n  Tab events (from userBehaviorEvents):               ${tabFromEvents}`);
console.log(`  TabActivities (from tabActivities):                 ${tabFromCol}`);

// Network
const netFromEvents = await db.collection('userBehaviorEvents').countDocuments({ 
  eventType: { $in: ['heartbeat', 'device_metrics'] } 
});
const netFromCol = await db.collection('networkPerformances').countDocuments();
console.log(`\n  Network (from userBehaviorEvents heartbeat):        ${netFromEvents}`);
console.log(`  NetworkPerformances (from networkPerformances):     ${netFromCol}`);

// SessionReplays
const srpFromEvents = await db.collection('sessionReplays').countDocuments();
console.log(`\n  SessionReplays:                                     ${srpFromEvents}`);

// Search
const searchFromEvents = await db.collection('userBehaviorEvents').countDocuments({ eventType: 'search' });
const searchFromCol = await db.collection('searchAnalytics').countDocuments();
console.log(`\n  Search (from userBehaviorEvents 'search'):          ${searchFromEvents}`);
console.log(`  SearchAnalytics (from searchAnalytics):             ${searchFromCol}`);

// ABTests
const abtests = await db.collection('abTests').countDocuments({ status: 'running' });
console.log(`\n  A/B Tests running:                                  ${abtests}`);

// PredictiveAnalytics
const pred = await db.collection('predictiveAnalytics').countDocuments();
console.log(`  PredictiveAnalytics:                                ${pred}`);

console.log('\n' + '═'.repeat(60));
console.log('✅ Analysis complete\n');
await mongoose.disconnect();
process.exit(0);
