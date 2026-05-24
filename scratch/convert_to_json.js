import fs from 'fs';
import path from 'path';

// Read the publishing script
const content = fs.readFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/publish_phase_1_5.js', 'utf8');

// We want to extract the topics array.
// To do this dynamically and safely, we can strip the mongoose/dotenv/schema parts and execute the module.
// But since the file is ES Modules, we can also dynamic-import it or require it!
// Let's create a temporary file that only exports the topics array.
const tempFile = 'c:/Users/Imran hossan/store/webstore-backend/scratch/temp_topics.js';
const topicsOnly = content.substring(
  content.indexOf('const topics = ['),
  content.lastIndexOf('];') + 2
);

fs.writeFileSync(tempFile, 'export ' + topicsOnly + '\n');

// Import it dynamically
import('./temp_topics.js').then((module) => {
  fs.writeFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/articles.json', JSON.stringify(module.topics, null, 2));
  console.log('✅ Generated articles.json successfully!');
  // Clean up
  try {
    fs.unlinkSync(tempFile);
  } catch (e) {}
  process.exit(0);
}).catch((err) => {
  console.error('Failed to import:', err);
  process.exit(1);
});
