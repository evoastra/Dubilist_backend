// ===========================================
// MAINTENANCE MODE MIDDLEWARE
// ===========================================

const { prisma } = require('../config/database');
const { env } = require('../config/env');
const { logger } = require('../config/logger');

// Cache for maintenance status
let maintenanceCache = {
  enabled: env.MAINTENANCE_MODE,
  lastChecked: Date.now(),
};

const CACHE_TTL = 60000; // 1 minute

// Check maintenance mode
const maintenanceMode = async (req, res, next) => {
  try {
    // Skip for health check
    if (req.path === '/health') {
      return next();
    }

    // Skip for admin routes (admins can access during maintenance)
    if (req.path.includes('/admin')) {
      return next();
    }

    // Check if cache is stale
    const now = Date.now();
    if (now - maintenanceCache.lastChecked > CACHE_TTL) {
      // Refresh from database
      try {
        const config = await prisma.systemConfig.findUnique({
          where: { key: 'maintenance_mode' },
        });
        maintenanceCache = {
          enabled: config?.value === 'true',
          lastChecked: now,
        };
      } catch (error) {
        // If DB check fails, use env variable
        maintenanceCache = {
          enabled: env.MAINTENANCE_MODE,
          lastChecked: now,
        };
      }
    }

    // Check if maintenance mode is enabled
    if (maintenanceCache.enabled) {
      logger.info({
        ip: req.ip,
        path: req.path,
      }, 'Request blocked - maintenance mode');

      return res.status(503).json({
        success: false,
        error: {
          code: 'MAINTENANCE_MODE',
          message: 'The system is currently under maintenance. Please try again later.',
        },
      });
    }

    next();
  } catch (error) {
    // If error, allow request to proceed
    logger.error({ error }, 'Error checking maintenance mode');
    next();
  }
};

// Toggle maintenance mode (for admin use)
const setMaintenanceMode = async (enabled) => {
  try {
    await prisma.systemConfig.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'maintenance_mode', value: enabled ? 'true' : 'false' },
    });

    // Update cache immediately
    maintenanceCache = {
      enabled,
      lastChecked: Date.now(),
    };

    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to set maintenance mode');
    throw error;
  }
};

module.exports = { maintenanceMode, setMaintenanceMode };