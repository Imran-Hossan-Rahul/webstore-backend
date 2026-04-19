import Redis from 'ioredis';

const urlsToTest = [
  "rediss://default:ApOEAAIgcDFn8nVfE30nOMyxOyAng09bzXJe6bOjVX-rcy_cE0Yyfw==@moving-heron-37764.upstash.io:6379",
  "rediss://:ApOEAAIgcDFn8nVfE30nOMyxOyAng09bzXJe6bOjVX-rcy_cE0Yyfw==@moving-heron-37764.upstash.io:6379",
  "rediss://default:ApOEAAIgcDFn8nVfE30nOMyxOyAng09bzXJe6bOjVX-rcy_cE0Yyfw@moving-heron-37764.upstash.io:6379",
  "rediss://:ApOEAAIgcDFn8nVfE30nOMyxOyAng09bzXJe6bOjVX-rcy_cE0Yyfw@moving-heron-37764.upstash.io:6379"
];

async function testConnection(url, index) {
  console.log(`Testing URL ${index + 1}...`);
  return new Promise((resolve) => {
    const redis = new Redis(url, { maxRetriesPerRequest: 0, showFriendlyErrorStack: true, connectTimeout: 5000 });
    
    redis.on('connect', () => {
      console.log(`✅ URL ${index + 1} SUCCESS!`);
      redis.disconnect();
      resolve(true);
    });

    redis.on('error', (err) => {
      console.log(`❌ URL ${index + 1} FAILED:`, err.message);
      redis.disconnect();
      resolve(false);
    });
  });
}

async function run() {
  for (let i = 0; i < urlsToTest.length; i++) {
    await testConnection(urlsToTest[i], i);
  }
  process.exit(0);
}

run();
