// ===========================================
// SESSIONS SERVICE & ROUTES
// Feature: User Sessions Management
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');

class SessionService {
  // Get all active sessions for user
  async getUserSessions(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.deviceSession.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deviceSession.count({ where: { userId } }),
    ]);

    return {
      data: sessions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Get session by ID
  async getSession(sessionId, userId) {
    const session = await prisma.deviceSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }

    return session;
  }

  // Terminate a specific session
  async terminateSession(sessionId, userId) {
    const session = await prisma.deviceSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }

    await prisma.deviceSession.delete({
      where: { id: sessionId },
    });

    // Revoke any refresh tokens for this device
    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        // If we had device fingerprint in token, we'd filter here
      },
    });

    logger.info({ sessionId, userId }, 'Session terminated');

    return { message: 'Session terminated' };
  }

  // Terminate all sessions except current
  async terminateAllOtherSessions(userId, currentSessionId) {
    const result = await prisma.deviceSession.deleteMany({
      where: {
        userId,
        id: { not: currentSessionId },
      },
    });

    logger.info({ userId, count: result.count }, 'All other sessions terminated');

    return { message: `${result.count} sessions terminated` };
  }

  // Update session activity
  async updateSessionActivity(sessionId) {
    await prisma.deviceSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  }

  // Clean up old sessions (for cron job)
  async cleanupOldSessions(daysOld = 30) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.deviceSession.deleteMany({
      where: {
        lastSeenAt: { lt: cutoff },
      },
    });

    logger.info({ count: result.count, daysOld }, 'Old sessions cleaned up');

    return result.count;
  }
}

const sessionService = new SessionService();

// Routes
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await sessionService.getUserSessions(req.user.id, req.query);
    paginatedResponse(res, result);
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const session = await sessionService.getSession(
      parseInt(req.params.id, 10),
      req.user.id
    );
    successResponse(res, session);
  })
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await sessionService.terminateSession(
      parseInt(req.params.id, 10),
      req.user.id
    );
    successResponse(res, null, 'Session terminated');
  })
);

router.delete(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const currentSessionId = req.headers['x-session-id'];
    await sessionService.terminateAllOtherSessions(
      req.user.id,
      currentSessionId ? parseInt(currentSessionId, 10) : null
    );
    successResponse(res, null, 'All other sessions terminated');
  })
);

module.exports = router;
module.exports.sessionService = sessionService;