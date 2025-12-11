// ===========================================
// RATE LIMIT CONFIGURATION
// ===========================================

const rateLimit = require('express-rate-limit');
const { env } = require('./env');
const { logger } = require('./logger');

// Response handler for rate limit exceeded
const rateLimitHandler = (req, res) => {
  logger.warn({
    ip: req.ip,
    path: req.path,
    method: req.method,
  }, 'Rate limit exceeded');

  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

// Skip function for certain paths
const skipPaths = ['/health', '/api/webhooks'];

// Global rate limiter
const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => skipPaths.some(path => req.path.startsWith(path)),
  keyGenerator: (req) => req.ip,
});

// Auth rate limiter (stricter)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

// Chat rate limiter
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.CHAT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `${req.user?.id || req.ip}:${req.params.id}`,
  message: {
    success: false,
    error: {
      code: 'CHAT_RATE_LIMIT_EXCEEDED',
      message: 'Too many messages. Please slow down.',
    },
  },
});

// OTP rate limiter
const otpRateLimiter = rateLimit({
  windowMs: env.OTP_COOLDOWN_MINUTES * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: {
    success: false,
    error: {
      code: 'OTP_RATE_LIMIT_EXCEEDED',
      message: `Please wait ${env.OTP_COOLDOWN_MINUTES} minute(s) before requesting another OTP.`,
    },
  },
});

// Search rate limiter
const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Upload rate limiter
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.user?.id || req.ip,
});

module.exports = {
  globalRateLimiter,
  authRateLimiter,
  chatRateLimiter,
  otpRateLimiter,
  searchRateLimiter,
  uploadRateLimiter,
};