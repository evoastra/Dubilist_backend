// ===========================================
// DEVICE TRACKING MIDDLEWARE
// ===========================================

const UAParser = require('ua-parser-js');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { getClientIp } = require('./apiUsageLogger');

// Parse device info from user agent
const parseDeviceInfo = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || 'Unknown',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || 'Unknown',
    device: result.device.type || 'desktop',
    deviceModel: result.device.model || 'Unknown',
    deviceVendor: result.device.vendor || 'Unknown',
  };
};

// Track device session
const trackDevice = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseDeviceInfo(userAgent);

    // Find or create device session
    const existing = await prisma.deviceSession.findFirst({
      where: {
        userId: req.user.id,
        ipAddress,
        userAgent,
      },
    });

    if (existing) {
      await prisma.deviceSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      await prisma.deviceSession.create({
        data: {
          userId: req.user.id,
          ipAddress,
          userAgent,
          deviceInfo,
        },
      });
    }

    // Attach device info to request
    req.deviceInfo = deviceInfo;
    req.ipAddress = ipAddress;

    next();
  } catch (error) {
    // Don't block request on tracking failure
    logger.error({ error }, 'Failed to track device');
    next();
  }
};

// Get device info without tracking
const getDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  return {
    ...parseDeviceInfo(userAgent),
    ipAddress: getClientIp(req),
    userAgent,
  };
};

module.exports = { trackDevice, parseDeviceInfo, getDeviceInfo };