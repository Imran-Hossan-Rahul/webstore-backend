import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workersDir = path.join(__dirname, '../workers');

const files = fs.readdirSync(workersDir).filter(f => f.endsWith('.js') && f !== 'index.js');

for (const file of files) {
  const filePath = path.join(workersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip residual connection.on("connect") and error tracking since ../config/redis.js already logs it!
  content = content.replace(/connection\.on\([\s\S]*?\);\r?\n?/g, '');
  content = content.replace(/redis\.on\([\s\S]*?\);\r?\n?/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed syntax errors in workers!');
