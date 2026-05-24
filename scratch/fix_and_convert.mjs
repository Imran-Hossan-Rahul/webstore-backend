import fs from 'fs';

// Read raw file content
const content = fs.readFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/publish_phase_1_5.js', 'utf8');

let sanitized = '';
let insideContentString = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  
  if (char === '`') {
    // Check if this is the start of content: content: `
    const isStart = content.substring(i - 10, i).includes('content:');
    // Check if this is the end of content: ` followed by , and next object or end of array
    const isEnd = content.substring(i + 1, i + 30).trim().startsWith(',') || content.substring(i + 1, i + 30).trim().startsWith(']');
    
    if (isStart) {
      insideContentString = true;
      sanitized += char;
    } else if (isEnd && insideContentString) {
      insideContentString = false;
      sanitized += char;
    } else {
      // It is an internal backtick! Escape it.
      sanitized += '\\`';
    }
  } else {
    sanitized += char;
  }
}

// Write the sanitized JS to a temp file
const tempFile = 'c:/Users/Imran hossan/store/webstore-backend/scratch/temp_sanitized.mjs';
fs.writeFileSync(tempFile, sanitized);

// Import dynamically
import('./temp_sanitized.mjs').then((module) => {
  fs.writeFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/articles.json', JSON.stringify(module.topics, null, 2));
  console.log('✅ Successfully sanitized and generated articles.json!');
  try {
    fs.unlinkSync(tempFile);
  } catch (e) {}
  process.exit(0);
}).catch((err) => {
  console.error('❌ Failed to compile even after sanitization:', err);
  // Keep temp file for inspection on failure
  process.exit(1);
});
