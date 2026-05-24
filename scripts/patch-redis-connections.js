import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const craftsmansDir = path.join(__dirname, '../craftsmans');

const filesToFix = [
  'flushCraftsmanFixed.js',
  'flushImpressionCraftsman.js'
];

for (const file of filesToFix) {
  const filePath = path.join(craftsmansDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace usage of raw `connection` instances with `redis`
  content = content.replace(/connection\.eval/g, 'redis.eval');
  content = content.replace(/connection\.scan/g, 'redis.scan');
  content = content.replace(/connection\.incrby/g, 'redis.incrby');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Fixed redis connection references in flush craftsmans!');
