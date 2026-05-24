# Card Shape Migration

## সমস্যা
পুরনো codex গুলোতে `small`, `medium`, `large`, `wide`, `tall` এই shape values ছিল কিন্তু নতুন system এ `square-small`, `square-medium` ইত্যাদি ব্যবহার হচ্ছে।

## সমাধান
এই migration script পুরনো values গুলো নতুন values এ convert করবে।

## Migration Mapping
- `small` → `square-small`
- `medium` → `square-medium`
- `large` → `square-medium`
- `wide` → `rectangle-horizontal`
- `tall` → `rectangle-vertical`

## কিভাবে চালাবেন

```bash
cd backend
node scripts/migrateCardShapes.js
```

## নোট
- Migration চালানোর আগে database backup নিন
- Script automatically সব পুরনো codexs update করবে
- Migration একবার চালালেই হবে
