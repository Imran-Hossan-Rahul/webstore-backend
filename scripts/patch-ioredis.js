import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const craftsmansDir = path.join(__dirname, '../craftsmans');

const files = fs.readdirSync(craftsmansDir).filter(f => f.endsWith('.js') && f !== 'index.js');

for (const file of files) {
  const filePath = path.join(craftsmansDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Catch files that imported 'IORedis' instead of 'Redis'
  if (content.includes('import IORedis from "ioredis";') || content.includes("import IORedis from 'ioredis';")) {
    content = content.replace(/import\s+IORedis\s+from\s+["']ioredis["'];/g, 'import redis from "../config/redis.js";');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  }
}
console.log('Done patching IORedis imports!');
