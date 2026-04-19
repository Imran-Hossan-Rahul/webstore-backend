import Redis from 'ioredis';

async function testConnection() {
  const url = "rediss://default:ApOEAAIgcDFn8nVfE30nOMyxOyAng09bzXJe6bOjVX-rcy_cE0Yyfw==@moving-heron-37764.upstash.io:6379";
  const redis = new Redis(url, { maxRetriesPerRequest: null });
  
  redis.on('connect', () => {
    console.log(`✅ SUCCESS! options:`, redis.options);
    redis.disconnect();
    process.exit(0);
  });

  redis.on('error', (err) => {
    console.log(`❌ FAILED:`, err.message);
    console.log('Options were:', redis.options);
    redis.disconnect();
    process.exit(1);
  });
}

testConnection();
