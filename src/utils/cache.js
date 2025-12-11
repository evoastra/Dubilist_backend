// ===========================================
// CACHE SERVICE
// Feature #50: Search Result Caching
// In-memory cache (can be replaced with Redis)
// ===========================================

const { logger } = require('../../config/logger');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.maxSize = 1000; // Max items in cache

    // Cleanup expired items every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  // Generate cache key from object
  generateKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  // Get item from cache
  get(key) {
    const expiry = this.ttls.get(key);
    
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  // Set item in cache
  set(key, value, ttl = this.defaultTTL) {
    // Evict old items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.ttls.set(key, Date.now() + ttl);

    logger.debug({ key, ttl }, 'Cache set');
  }

  // Delete item from cache
  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.ttls.clear();
    logger.info('Cache cleared');
  }

  // Clear cache by prefix
  clearByPrefix(prefix) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        count++;
      }
    }
    logger.info({ prefix, count }, 'Cache cleared by prefix');
  }

  // Cleanup expired items
  cleanup() {
    const now = Date.now();
    let count = 0;

    for (const [key, expiry] of this.ttls.entries()) {
      if (now > expiry) {
        this.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug({ count }, 'Expired cache items cleaned');
    }
  }

  // Evict oldest items when cache is full
  evictOldest() {
    const entries = Array.from(this.ttls.entries());
    entries.sort((a, b) => a[1] - b[1]);

    // Remove oldest 10%
    const toRemove = Math.ceil(this.maxSize * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.delete(entries[i][0]);
    }

    logger.debug({ count: toRemove }, 'Evicted old cache items');
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    };
  }

  // Cached wrapper for async functions
  async cached(key, fetchFn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== null) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    logger.debug({ key }, 'Cache miss');
    const result = await fetchFn();
    this.set(key, result, ttl);
    return result;
  }
}

// Singleton instance
const cacheService = new CacheService();

// Cache middleware for routes
const cacheMiddleware = (prefix, ttl) => {
  return async (req, res, next) => {
    const key = cacheService.generateKey(prefix, { ...req.query, ...req.params });
    const cached = cacheService.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (data) => {
      if (res.statusCode === 200) {
        cacheService.set(key, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = { cacheService, cacheMiddleware };