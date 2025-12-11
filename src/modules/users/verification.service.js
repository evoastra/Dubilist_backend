// ===========================================
// USER VERIFICATION SERVICE
// Feature #11: User Document Verification
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError } = require('../../middleware/errorHandler');
const { s3Service } = require('../uploads/s3.service');

class VerificationService {
  // Submit verification documents
  async submitVerification(userId, data) {
    const { documentType, documentUrl, documentS3Key } = data;

    // Check for existing pending verification
    const existing = await prisma.userVerification.findFirst({
      where: { userId, status: 'pending' },
    });

    if (existing) {
      throw new ApiError(400, 'VERIFICATION_PENDING', 'You already have a pending verification request');
    }

    const verification = await prisma.userVerification.create({
      data: {
        userId,
        documentType,
        documentUrl,
        documentS3Key,
        status: 'pending',
      },
    });

    // Add to moderation queue
    await prisma.moderationQueue.create({
      data: {
        itemType: 'user_verification',
        itemId: verification.id,
        status: 'pending',
      },
    });

    logger.info({ userId, verificationId: verification.id }, 'Verification submitted');

    return verification;
  }

  // Get user's verification status
  async getVerificationStatus(userId) {
    const verification = await prisma.userVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return verification;
  }

  // Approve verification (admin)
  async approveVerification(verificationId, adminId) {
    const verification = await prisma.userVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new ApiError(404, 'NOT_FOUND', 'Verification not found');
    }

    await prisma.$transaction([
      prisma.userVerification.update({
        where: { id: verificationId },
        data: {
          status: 'approved',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: verification.userId },
        data: { isVerified: true },
      }),
    ]);

    // Notify user
    await prisma.notification.create({
      data: {
        userId: verification.userId,
        type: 'system',
        title: 'Verification Approved',
        message: 'Your account has been verified!',
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'VERIFICATION_APPROVED',
        entityType: 'user_verification',
        entityId: verificationId,
        ipAddress: 'admin',
      },
    });

    logger.info({ verificationId, adminId }, 'Verification approved');

    return { message: 'Verification approved' };
  }

  // Reject verification (admin)
  async rejectVerification(verificationId, adminId, reason) {
    const verification = await prisma.userVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new ApiError(404, 'NOT_FOUND', 'Verification not found');
    }

    await prisma.userVerification.update({
      where: { id: verificationId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: verification.userId,
        type: 'system',
        title: 'Verification Rejected',
        message: `Your verification was rejected: ${reason}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'VERIFICATION_REJECTED',
        entityType: 'user_verification',
        entityId: verificationId,
        metadata: { reason },
        ipAddress: 'admin',
      },
    });

    logger.info({ verificationId, adminId, reason }, 'Verification rejected');

    return { message: 'Verification rejected' };
  }

  // Get pending verifications (admin)
  async getPendingVerifications(options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [verifications, total] = await Promise.all([
      prisma.userVerification.findMany({
        where: { status: 'pending' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.userVerification.count({ where: { status: 'pending' } }),
    ]);

    return {
      data: verifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

module.exports = { verificationService: new VerificationService() };