// ===========================================
// LISTING EXPIRY JOB
// ===========================================

const cron = require('node-cron');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');

const processExpiredListings = async () => {
  try {
    const now = new Date();

    // Find and update expired listings
    const result = await prisma.listing.updateMany({
      where: {
        status: 'approved',
        expiresAt: { lt: now },
        isDeleted: false,
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Listings marked as expired');

      // Create notifications for expired listings
      const expiredListings = await prisma.listing.findMany({
        where: {
          status: 'expired',
          expiresAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000), // Last hour
            lt: now,
          },
        },
        select: { id: true, userId: true, title: true },
      });

      for (const listing of expiredListings) {
        await prisma.notification.create({
          data: {
            userId: listing.userId,
            type: 'listing_expired',
            title: 'Listing Expired',
            message: `Your listing "${listing.title}" has expired. Renew it to keep it active.`,
            data: { listingId: listing.id },
          },
        });
      }
    }
  } catch (error) {
    logger.error({ error }, 'Listing expiry job failed');
  }
};

// Run daily at midnight
const startListingExpiryJob = () => {
  cron.schedule('0 0 * * *', processExpiredListings);
  logger.info('Listing expiry job scheduled (daily at midnight)');
};

module.exports = { startListingExpiryJob, processExpiredListings };