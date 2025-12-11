// ===========================================
// RATE LIMITER MIDDLEWARE
// ===========================================

const {
  globalRateLimiter,
  authRateLimiter,
  chatRateLimiter,
  otpRateLimiter,
  searchRateLimiter,
  uploadRateLimiter,
} = require('../config/rateLimit');

module.exports = {
  globalRateLimiter,
  authRateLimiter,
  chatRateLimiter,
  otpRateLimiter,
  searchRateLimiter,
  uploadRateLimiter,
};