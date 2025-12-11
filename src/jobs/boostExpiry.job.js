// ===========================================
// BOOST EXPIRY JOB
// ===========================================

const cron = require('node-cron');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');

const processExpiredBoosts = async () => {
  try {
    const now = new Date();

    // Find and clear expired boosts
    const result = await prisma.listing.updateMany({
      where: {
        boostedUntil: { lt: now },
        isDeleted: false,
      },
      data: {
        boostedUntil: null,
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Expired boosts cleared');
    }
  } catch (error) {
    logger.error({ error }, 'Boost expiry job failed');
  }
};

// Run every hour
const startBoostExpiryJob = () => {
  cron.schedule('0 * * * *', processExpiredBoosts);
  logger.info('Boost expiry job scheduled (hourly)');
};

module.exports = { startBoostExpiryJob, processExpiredBoosts };