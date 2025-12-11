// ===========================================
// FRAUD ANALYSIS JOB
// ===========================================

const cron = require('node-cron');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { env } = require('../config/env');

const analyzeFraudPatterns = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find users with multiple device sessions in last 24 hours
    const suspiciousDeviceSessions = await prisma.deviceSession.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: {
        createdAt: { gte: oneDayAgo },
      },
      having: {
        id: { _count: { gt: env.FRAUD_MAX_DEVICES_PER_DAY } },
      },
    });

    for (const session of suspiciousDeviceSessions) {
      await prisma.fraudLog.create({
        data: {
          userId: session.userId,
          type: 'MANY_DEVICES',
          details: {
            deviceCount: session._count.id,
            period: '24 hours',
            detectedBy: 'scheduled_analysis',
          },
          riskScore: 30,
        },
      });
    }

    // Find users with high rejection rates
    const usersWithRejections = await prisma.listing.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: {
        status: 'rejected',
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      having: {
        id: { _count: { gte: env.FRAUD_MAX_REJECTIONS_COUNT } },
      },
    });

    for (const user of usersWithRejections) {
      // Check if already logged
      const existing = await prisma.fraudLog.findFirst({
        where: {
          userId: user.userId,
          type: 'REPEATED_REJECTION',
          createdAt: { gte: oneDayAgo },
        },
      });

      if (!existing) {
        await prisma.fraudLog.create({
          data: {
            userId: user.userId,
            type: 'REPEATED_REJECTION',
            details: {
              rejectedCount: user._count.id,
              period: '7 days',
              detectedBy: 'scheduled_analysis',
            },
            riskScore: 35,
          },
        });
      }
    }

    // Calculate and log high-risk users summary
    const highRiskUsers = await prisma.fraudLog.groupBy({
      by: ['userId'],
      _sum: { riskScore: true },
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      having: {
        riskScore: { _sum: { gte: env.FRAUD_RISK_THRESHOLD } },
      },
    });

    logger.info({
      suspiciousDeviceSessions: suspiciousDeviceSessions.length,
      usersWithRejections: usersWithRejections.length,
      highRiskUsers: highRiskUsers.length,
    }, 'Fraud analysis completed');
  } catch (error) {
    logger.error({ error }, 'Fraud analysis job failed');
  }
};

// Run every 6 hours
const startFraudAnalysisJob = () => {
  cron.schedule('0 */6 * * *', analyzeFraudPatterns);
  logger.info('Fraud analysis job scheduled (every 6 hours)');
};

module.exports = { startFraudAnalysisJob, analyzeFraudPatterns };