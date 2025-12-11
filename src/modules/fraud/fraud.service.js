// ===========================================
// FRAUD DETECTION SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');

class FraudService {
  // Fraud rule types
  static RULES = {
    TOO_MANY_LISTINGS: 'TOO_MANY_LISTINGS',
    REPEATED_PHONE: 'REPEATED_PHONE',
    REPEATED_REJECTION: 'REPEATED_REJECTION',
    MANY_DEVICES: 'MANY_DEVICES',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  };

  // Check fraud on listing creation
  async onListingCreated(userId, listingId) {
    const results = [];

    // Rule 1: Too many listings in short time
    const tooManyListings = await this.checkTooManyListings(userId);
    if (tooManyListings) results.push(tooManyListings);

    // Rule 2: Repeated phone number across accounts
    const repeatedPhone = await this.checkRepeatedPhone(userId, listingId);
    if (repeatedPhone) results.push(repeatedPhone);

    // Calculate total risk score
    if (results.length > 0) {
      const totalRiskScore = results.reduce((sum, r) => sum + r.riskScore, 0);
      
      // Flag user if risk score exceeds threshold
      if (totalRiskScore >= env.FRAUD_RISK_THRESHOLD) {
        await this.flagHighRiskUser(userId, totalRiskScore);
      }
    }

    return results;
  }

  // Check fraud on listing rejection
  async onListingRejected(userId) {
    const repeatedRejection = await this.checkRepeatedRejection(userId);
    
    if (repeatedRejection) {
      if (repeatedRejection.riskScore >= env.FRAUD_RISK_THRESHOLD) {
        await this.flagHighRiskUser(userId, repeatedRejection.riskScore);
      }
    }

    return repeatedRejection;
  }

  // Check for many devices (on login)
  async checkManyDevices(userId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const deviceCount = await prisma.deviceSession.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (deviceCount > env.FRAUD_MAX_DEVICES_PER_DAY) {
      const fraudLog = await this.logFraud(userId, FraudService.RULES.MANY_DEVICES, {
        deviceCount,
        threshold: env.FRAUD_MAX_DEVICES_PER_DAY,
        period: '24 hours',
      }, 30);

      return fraudLog;
    }

    return null;
  }

  // Rule: Too many listings in short time
  async checkTooManyListings(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const listingCount = await prisma.listing.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (listingCount > env.FRAUD_MAX_LISTINGS_PER_HOUR) {
      const fraudLog = await this.logFraud(userId, FraudService.RULES.TOO_MANY_LISTINGS, {
        listingCount,
        threshold: env.FRAUD_MAX_LISTINGS_PER_HOUR,
        period: '1 hour',
      }, 40);

      return fraudLog;
    }

    return null;
  }

  // Rule: Same phone used across multiple accounts
  async checkRepeatedPhone(userId, listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { contactPhone: true },
    });

    if (!listing?.contactPhone) return null;

    // Find other users with same phone in listings
    const otherListings = await prisma.listing.findMany({
      where: {
        contactPhone: listing.contactPhone,
        userId: { not: userId },
        isDeleted: false,
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    if (otherListings.length > 0) {
      const fraudLog = await this.logFraud(userId, FraudService.RULES.REPEATED_PHONE, {
        phone: listing.contactPhone.slice(-4), // Last 4 digits only
        otherUserCount: otherListings.length,
        listingId,
      }, 50);

      return fraudLog;
    }

    return null;
  }

  // Rule: Too many rejected listings
  async checkRepeatedRejection(userId) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rejectedCount = await prisma.listing.count({
      where: {
        userId,
        status: 'rejected',
        updatedAt: { gte: oneWeekAgo },
      },
    });

    if (rejectedCount >= env.FRAUD_MAX_REJECTIONS_COUNT) {
      const fraudLog = await this.logFraud(userId, FraudService.RULES.REPEATED_REJECTION, {
        rejectedCount,
        threshold: env.FRAUD_MAX_REJECTIONS_COUNT,
        period: '7 days',
      }, 35);

      // Optionally restrict posting
      if (rejectedCount >= env.FRAUD_MAX_REJECTIONS_COUNT * 2) {
        await prisma.user.update({
          where: { id: userId },
          data: { canPostListings: false },
        });

        logger.warn({ userId, rejectedCount }, 'User posting restricted due to repeated rejections');
      }

      return fraudLog;
    }

    return null;
  }

  // Log fraud event
  async logFraud(userId, type, details, riskScore) {
    const fraudLog = await prisma.fraudLog.create({
      data: {
        userId,
        type,
        details,
        riskScore,
      },
    });

    logger.warn({ userId, type, riskScore, details }, 'Fraud detected');

    return fraudLog;
  }

  // Flag high-risk user
  async flagHighRiskUser(userId, totalRiskScore) {
    // Log the flagging
    await this.logFraud(userId, 'HIGH_RISK_USER', {
      totalRiskScore,
      threshold: env.FRAUD_RISK_THRESHOLD,
      action: 'flagged',
    }, totalRiskScore);

    // Create notification for admins (via audit log)
    await prisma.auditLog.create({
      data: {
        actorUserId: userId, // The flagged user
        action: 'USER_FLAGGED_HIGH_RISK',
        entityType: 'user',
        entityId: userId,
        metadata: { totalRiskScore },
        ipAddress: 'system',
      },
    });

    logger.warn({ userId, totalRiskScore }, 'User flagged as high risk');
  }

  // Get fraud logs for user
  async getUserFraudLogs(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.fraudLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fraudLog.count({ where: { userId } }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get all fraud logs (admin)
  async getAllFraudLogs(options = {}) {
    const { page = 1, limit = 20, type, minRiskScore } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (type) where.type = type;
    if (minRiskScore) where.riskScore = { gte: parseInt(minRiskScore, 10) };

    const [logs, total] = await Promise.all([
      prisma.fraudLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fraudLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get high-risk users
  async getHighRiskUsers(options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Aggregate risk scores by user
    const highRiskUsers = await prisma.fraudLog.groupBy({
      by: ['userId'],
      _sum: { riskScore: true },
      _count: { id: true },
      having: {
        riskScore: { _sum: { gte: env.FRAUD_RISK_THRESHOLD } },
      },
      orderBy: { _sum: { riskScore: 'desc' } },
      skip,
      take: limit,
    });

    // Fetch user details
    const usersWithDetails = await Promise.all(
      highRiskUsers.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: {
            id: true,
            name: true,
            email: true,
            isBlocked: true,
            canPostListings: true,
            createdAt: true,
          },
        });

        return {
          user,
          totalRiskScore: item._sum.riskScore,
          fraudEventCount: item._count.id,
        };
      })
    );

    return {
      data: usersWithDetails.filter(u => u.user),
      pagination: { page, limit },
    };
  }

  // Mark fraud log as reviewed
  async markAsReviewed(fraudLogId, moderatorId) {
    await prisma.fraudLog.update({
      where: { id: fraudLogId },
      data: { isReviewed: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: moderatorId,
        action: 'FRAUD_LOG_REVIEWED',
        entityType: 'fraud_log',
        entityId: fraudLogId,
        ipAddress: 'system',
      },
    });

    return { message: 'Fraud log marked as reviewed' };
  }
}

module.exports = { fraudService: new FraudService() };