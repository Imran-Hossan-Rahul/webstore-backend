import NodeCache from 'node-cache';

// Standard TTL of 5 minutes (300 seconds), check for expired keys every 60 seconds
export const appCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = `__express__${req.originalUrl}` || req.url;
    const cachedBody = appCache.get(key);
    
    if (cachedBody) {
      return res.json(cachedBody);
    } else {
      // Overwrite res.json to cache the body before sending
      const originalJson = res.json;
      res.json = (body) => {
        appCache.set(key, body, duration);
        originalJson.call(res, body);
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
