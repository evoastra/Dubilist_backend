// ===========================================
// API USAGE LOGGER MIDDLEWARE
// ===========================================

const { prisma } = require('../config/database');
const { logger } = require('../config/logger');

// API usage logger middleware
const apiUsageLogger = async (req, res, next) => {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture response
  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    const latencyMs = Date.now() - startTime;
    const requestSize = parseInt(req.headers['content-length'] || 0, 10);

    // Calculate response size
    let responseSize = 0;
    if (chunk) {
      responseSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }

    // Log to database asynchronously
    logApiUsage({
      userId: req.user?.id || null,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      latencyMs,
      requestSizeBytes: requestSize,
      responseSizeBytes: responseSize,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      errorMessage: res.statusCode >= 400 ? res.locals.errorMessage : null,
    });

    // Log to console
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      latencyMs,
      userId: req.user?.id,
      ip: getClientIp(req),
    }, 'API Request');
  };

  next();
};

// Get client IP address
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
};

// Log API usage to database
const logApiUsage = async (data) => {
  try {
    await prisma.apiUsageLog.create({
      data,
    });
  } catch (error) {
    // Don't let logging errors affect the request
    logger.error({ error }, 'Failed to log API usage');
  }
};

module.exports = { apiUsageLogger, getClientIp };