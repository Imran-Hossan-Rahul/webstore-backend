import NodeCache from 'node-cache';

// Standard TTL of 5 minutes (300 seconds), check for expired keys every 60 seconds
export const appCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    // 🔒 SECURITY FIX: Append user ID to cache key to prevent cross-tenant data leaks
    const userKey = req.user ? `_user_${req.user._id}` : '_public';
    const key = `__express__${req.originalUrl || req.url}${userKey}`;
    const cachedBody = appCache.get(key);
    
    if (cachedBody) {
      return res.json(cachedBody);
    } else {
      // Overwrite res.json to cache the body before sending
      const originalJson = res.json;
      res.json = function(body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          appCache.set(key, body, duration);
        }
        return originalJson.call(res, body);
      };
      next();
    }
  };
};

export const clearCache = (pattern) => {
  const keys = appCache.keys();
  const toDelete = keys.filter(k => k.includes(pattern));
  appCache.del(toDelete);
};
