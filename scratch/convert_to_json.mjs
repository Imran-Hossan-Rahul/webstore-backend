import fs from 'fs';
import path from 'path';

// Read the publishing script
const content = fs.readFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/publish_phase_1_5.js', 'utf8');

// Find the topics array start and end
const start = content.indexOf('const topics = [');
const end = content.lastIndexOf('];') + 2;
const topicsOnly = content.substring(start, end);

// Write to a temporary file
const tempFile = 'c:/Users/Imran hossan/store/webstore-backend/scratch/temp_topics.mjs';
fs.writeFileSync(tempFile, 'export ' + topicsOnly + '\n');

// Import it dynamically
import('./temp_topics.mjs').then((module) => {
  fs.writeFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/articles.json', JSON.stringify(module.topics, null, 2));
  console.log('✅ Generated articles.json successfully!');
  // Clean up
  try {
    fs.unlinkSync(tempFile);
  } catch (e) {}
  process.exit(0);
}).catch((err) => {
  console.error('Failed to import:', err);
  // Clean up on failure
  try {
    fs.unlinkSync(tempFile);
  } catch (e) {}
  process.exit(1);
});
