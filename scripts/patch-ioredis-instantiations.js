import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workersDir = path.join(__dirname, '../workers');

const filesToFix = [
  'blogImageWorker.js',
  'chatMediaWorker.js',
  'postImageWorker.js',
  'profileImageWorker.js',
  'projectResourceWorker.js',
  'quickPostMediaWorker.js',
  'rankingWorkerFixed.js'
];

for (const file of filesToFix) {
  const filePath = path.join(workersDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Remove `const connection = new IORedis(...)` entirely
  content = content.replace(/const\s+connection\s*=\s*new\s*IORedis\([^)]*\);\r?\n?/g, '');
  content = content.replace(/const\s+connection\s*=\s*new\s*IORedis\([\s\S]*?\);\r?\n?/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed new IORedis usages!');
