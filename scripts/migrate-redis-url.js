import fs from 'fs';
import path from 'path';

function fixRedisConnections(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixRedisConnections(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      let modified = false;

      // Replace `new IORedis({ ...host... })` or `new Redis({ ...host... })`
      const regex = /new\s+(IORedis|Redis)\(\s*\{[\s\S]*?host:[\s\S]*?\}\s*\)/g;
      if (regex.test(content)) {
        content = content.replace(regex, 'new $1(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null })');
        modified = true;
      }

      // Also specifically check files using Redis options objects
      if (file === 'redisClient.js' || file === 'flushCraftsmanFixed.js' || file === 'flushImpressionCraftsman.js') {
        const optionRegex = /new\s+(IORedis|Redis)\(options\)/g;
        if (optionRegex.test(content)) {
          content = content.replace(optionRegex, 'new $1(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null })');
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

const targetDirs = [
  path.join(process.cwd(), 'craftsmans'),
  path.join(process.cwd(), 'queues'),
  path.join(process.cwd(), 'controllers'),
  path.join(process.cwd(), 'config'),
  path.join(process.cwd(), 'utils')
];

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    console.log(`Scanning ${dir}...`);
    fixRedisConnections(dir);
  }
}
console.log("✅ Codebase completely migrated to REDIS_URL.");
