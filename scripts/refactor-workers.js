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

  // 1. Remove QueueEvents from import
  content = content.replace(/import\s*\{\s*Craftsman\s*,\s*QueueEvents\s*\}\s*from\s*"bullmq";/g, 'import { Craftsman } from "bullmq";');
  content = content.replace(/import\s*\{\s*Craftsman\s*,\s*QueueEvents\s*\}\s*from\s*'bullmq';/g, "import { Craftsman } from 'bullmq';");

  // 2. Change Redis import
  content = content.replace(/import\s+Redis\s+from\s+["']ioredis["'];/g, 'import redis from "../config/redis.js";');

  // 3. Remove mongoose import and config index import if unused directly (some models use them, but we'll strip the connection string)
  content = content.replace(/import\s+\{\s*MONGODB_CONNECTION_STRING\s*\}\s*from\s+["']\.\.\/config\/index\.js["'];\r?\n?/g, '');
  
  // Strip mongoose Connect block
  content = content.replace(/\/\/\s*-+\r?\n\/\/\s*MongoDB Connect\r?\n\/\/\s*-+\r?\n.*mongoose\s*\.connect\([^)]+\)\s*\.then\([\s\S]*?\.catch\([\s\S]*?\);\r?\n?/g, '');
  content = content.replace(/mongoose\s*\.connect\([^)]+\)\s*\.then\([\s\S]*?\.catch\([\s\S]*?\);\r?\n?/g, '');

  content = content.replace(/\/\/\s*-+\r?\n\/\/\s*MongoDB Connection\r?\n\/\/\s*-+\r?\n.*mongoose\s*\.connect\([^)]+\)\s*\.then\([\s\S]*?\.catch\([\s\S]*?\);\r?\n?/g, '');

  // 4. Strip Redis Connection block
  content = content.replace(/\/\/\s*-+\r?\n\/\/\s*Redis Connection\r?\n\/\/\s*-+\r?\n/g, '');
  content = content.replace(/const\s+connection\s*=\s*new\s*Redis\([^)]+\);\r?\n?/g, '');
  content = content.replace(/const\s+redis\s*=\s*new\s*Redis\([^)]+\);\r?\n?/g, '');
  content = content.replace(/connection\.on\([^)]+\);\r?\n?/g, '');
  content = content.replace(/redis\.on\([^)]+\);\r?\n?/g, '');

  // 5. Strip Queue Events Logging entirely
  content = content.replace(/\/\/\s*-+\r?\n\/\/\s*Queue Event Logging\r?\n\/\/\s*-+\r?\n/g, '');
  content = content.replace(/const\s+queueEvents\s*=\s*new\s*QueueEvents\([^;]+;\r?\n?/g, '');
  content = content.replace(/queueEvents\.on\([^)]+\)\s*=>\s*console\.log\([^)]+\)\s*\);\r?\n?/g, '');
  content = content.replace(/queueEvents\.on\([^;]+;\r?\n?/g, '');

  // fallback logic for queue events spanning multiple lines gracefully
  content = content.replace(/queueEvents\.on\([\s\S]*?\);\r?\n/g, '');


  // 6. Update Craftsman instantiation
  content = content.replace(/\{\s*connection\s*,/g, '{ connection: redis,');
  content = content.replace(/\{\s*connection\s*\}/g, '{ connection: redis }');
  content = content.replace(/\{\s*connection:\s*redis\s*,\s*connection/g, '{ connection: redis'); // catch accidental duplicates
  content = content.replace(/\{\s*connection\s*:\s*connection\s*,/g, '{ connection: redis,');
  content = content.replace(/\{\s*connection\s*:\s*connection\s*\}/g, '{ connection: redis }');

  // Also replace `{ connection }` if it's `{connection}`
  content = content.replace(/\{connection,/g, '{ connection: redis,');
  content = content.replace(/\{connection\}/g, '{ connection: redis }');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Done refactoring craftsmans!');
