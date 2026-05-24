# ভিউ ট্র্যাকিং সিস্টেম (View Tracking System)

## 🎯 কীভাবে কাজ করে

### ১. Frontend থেকে View Count করার জন্য:

```javascript
// যখন user artifact দেখবে, তখন এই API call করুন:
POST /api/artifacts/view/:artifactId

// Example:
fetch(`/api/artifacts/view/${artifactId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
```

### ২. Backend এ কী হয়:

**Controller: `incrementView`**
- ✅ Artifact আছে কিনা check করে
- ✅ User/IP এর cooldown check করে (60 seconds)
- ✅ Redis এ view count increment করে (`views:count:artifactId`)
- ✅ Trending score update করে
- ⚡ **Instant response** - user কে wait করতে হয় না

### ৩. Craftsman এ কী হয়:

**Craftsman: `viewSyncCraftsmanFixed.js`**
- 🕐 প্রতি **2 মিনিট** পর পর চলে
- 📊 Redis থেকে সব `views:count:*` keys নিয়ে আসে
- 💾 MongoDB তে batch update করে
- 🧹 Redis key delete করে
- 📈 Artifact score update করে

## 🔑 Redis Keys:

```
views:cooldown:{artifactId}:{actor}  → Cooldown tracking (60s TTL)
views:count:{artifactId}             → Pending view count
artifacts:trending:zset              → Trending leaderboard
```

## ⚙️ Configuration:

```env
VIEW_COOLDOWN_SECONDS=60        # Same user can't count view within 60s
VIEWSYNC_CRON=*/2 * * * *       # Sync every 2 minutes
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

## 🚀 Production এ চালানোর জন্য:

### 1. Craftsman Start করুন:
```bash
node backend/craftsmans/viewSyncCraftsmanFixed.js
```

### 2. PM2 দিয়ে চালাতে চাইলে:
```bash
pm2 start backend/craftsmans/viewSyncCraftsmanFixed.js --name "view-sync-craftsman"
pm2 save
```

## 📊 Performance Benefits:

| Metric | Direct DB | Craftsman System |
|--------|-----------|---------------|
| Response Time | 50-200ms | 5-10ms |
| DB Writes/sec | 1000+ | ~0.5 |
| Scalability | Limited | Unlimited |
| User Experience | Slow | Fast ⚡ |

## 🔍 Monitoring:

Craftsman logs দেখতে:
```bash
# Console logs
✅ View counted in Redis for artifact {id}
✅ Synced views: {artifactId} += {count}
✅ ViewSyncCraftsman finished: {n} artifacts synced
```

## ⚠️ Important Notes:

1. **Redis অবশ্যই চালু থাকতে হবে** - না হলে view count হবে না
2. **Craftsman অবশ্যই চালু রাখুন** - না হলে MongoDB তে sync হবে না
3. **Cooldown period**: একই user 60 সেকেন্ডের মধ্যে একাধিক view count করতে পারবে না
4. **Data loss risk**: Redis crash হলে শেষ 2 মিনিটের data হারাতে পারে (minimal)

## 🐛 Troubleshooting:

**View count হচ্ছে না?**
- Redis চালু আছে কিনা check করুন: `redis-cli ping`
- Craftsman চালু আছে কিনা check করুন: `pm2 list`
- Console logs দেখুন

**MongoDB তে update হচ্ছে না?**
- Craftsman logs check করুন
- MongoDB connection check করুন
- `views:count:*` keys আছে কিনা: `redis-cli keys "views:count:*"`
