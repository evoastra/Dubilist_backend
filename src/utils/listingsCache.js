const NodeCache = require('node-cache');

const listingsCache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

function flushListingsCache() {
  listingsCache.flushAll();
}

module.exports = { listingsCache, flushListingsCache };
