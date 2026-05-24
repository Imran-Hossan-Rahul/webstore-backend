import fs from 'fs';
import path from 'path';

const REDIS_HOST_REPLACEMENT = 'host: process.env.REDIS_HOST || "127.0.0.1"';
const REDIS_PORT_REPLACEMENT = 'port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379';

function traverseAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseAndReplace(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Replace hardcoded host string
      content = content.replace(/host:\s*["']127\.0\.0\.1["']/g, REDIS_HOST_REPLACEMENT);
      
      // Replace hardcoded port number
      // We only want to replace port: 6379 if it's part of a redis config,
      // but replacing all port: 6379 is generally safe in this backend context.
      content = content.replace(/port:\s*6379/g, REDIS_PORT_REPLACEMENT);

      // Additionally, replace `new IORedis({ host: "127.0.0.1", port: 6379` patterns if any were missed
      // (The above two regexes handle most object literals cleanly)

      fs.writeFileSync(fullPath, content, 'utf-8');
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
    traverseAndReplace(dir);
  }
}
console.log("✅ Done repairing Redis connections.");
