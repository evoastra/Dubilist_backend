// ===========================================
// REPORTS SERVICE & ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireModerator } = require('../../middleware/roleMiddleware');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');

// Service
class ReportService {
  async reportUser(reporterId, reportedUserId, reason, details = null) {
    if (reporterId === reportedUserId) {
      throw new ApiError(400, 'INVALID_REPORT', 'You cannot report yourself');
    }

    const reportedUser = await prisma.user.findUnique({
      where: { id: reportedUserId },
    });

    if (!reportedUser || reportedUser.isDeleted) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const existing = await prisma.reportedUser.findFirst({
      where: { reporterId, reportedUserId, status: 'pending' },
    });

    if (existing) {
      throw new ApiError(409, 'ALREADY_REPORTED', 'You have already reported this user');
    }

    const report = await prisma.reportedUser.create({
      data: { reporterId, reportedUserId, reason, details },
    });

    logger.info({ reporterId, reportedUserId, reason }, 'User reported');
    return report;
  }

  async reportListing(reporterId, listingId, reason, details = null) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    if (listing.userId === reporterId) {
      throw new ApiError(400, 'INVALID_REPORT', 'You cannot report your own listing');
    }

    const existing = await prisma.reportedListing.findFirst({
      where: { reporterId, listingId, status: 'pending' },
    });

    if (existing) {
      throw new ApiError(409, 'ALREADY_REPORTED', 'You have already reported this listing');
    }

    const report = await prisma.reportedListing.create({
      data: { reporterId, listingId, reason, details },
    });

    logger.info({ reporterId, listingId, reason }, 'Listing reported');
    return report;
  }

  async getReports(options = {}) {
    const { page = 1, limit = 20, type, status = 'pending' } = options;
    const skip = (page - 1) * limit;
    const results = {};

    if (!type || type === 'user') {
      const [userReports, userTotal] = await Promise.all([
        prisma.reportedUser.findMany({
          where: { status },
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            reportedUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'user' ? skip : 0,
          take: type === 'user' ? limit : 10,
        }),
        prisma.reportedUser.count({ where: { status } }),
      ]);
      results.userReports = userReports;
      results.userReportsTotal = userTotal;
    }

    if (!type || type === 'listing') {
      const [listingReports, listingTotal] = await Promise.all([
        prisma.reportedListing.findMany({
          where: { status },
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            listing: { include: { user: { select: { id: true, name: true } }, images: { take: 1 } } },
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'listing' ? skip : 0,
          take: type === 'listing' ? limit : 10,
        }),
        prisma.reportedListing.count({ where: { status } }),
      ]);
      results.listingReports = listingReports;
      results.listingReportsTotal = listingTotal;
    }

    return results;
  }

  async reviewReport(reportType, reportId, moderatorId, action, note = null) {
    const table = reportType === 'user' ? 'reportedUser' : 'reportedListing';
    const report = await prisma[table].findUnique({ where: { id: reportId } });

    if (!report) {
      throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found');
    }

    const newStatus = action === 'dismiss' ? 'dismissed' : 'actioned';

    await prisma[table].update({
      where: { id: reportId },
      data: { status: newStatus, reviewedBy: moderatorId, reviewedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: moderatorId,
        action: `REPORT_${action.toUpperCase()}`,
        entityType: `reported_${reportType}`,
        entityId: reportId,
        metadata: { note },
        ipAddress: 'system',
      },
    });

    logger.info({ reportType, reportId, action, moderatorId }, 'Report reviewed');
    return { message: `Report ${action}ed` };
  }
}

const reportService = new ReportService();

// Validation schemas
const reportSchema = Joi.object({
  reason: Joi.string().min(5).max(200).required(),
  details: Joi.string().max(1000),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid('user', 'listing'),
  status: Joi.string().valid('pending', 'reviewed', 'dismissed', 'actioned').default('pending'),
});

const reviewSchema = Joi.object({
  action: Joi.string().valid('dismiss', 'action').required(),
  note: Joi.string().max(500),
});

// Routes
router.post('/users/:userId', authenticate, validateBody(reportSchema), asyncHandler(async (req, res) => {
  const report = await reportService.reportUser(req.user.id, parseInt(req.params.userId, 10), req.body.reason, req.body.details);
  createdResponse(res, report, 'User reported');
}));

router.post('/listings/:listingId', authenticate, validateBody(reportSchema), asyncHandler(async (req, res) => {
  const report = await reportService.reportListing(req.user.id, parseInt(req.params.listingId, 10), req.body.reason, req.body.details);
  createdResponse(res, report, 'Listing reported');
}));

router.get('/', authenticate, requireModerator, validateQuery(querySchema), asyncHandler(async (req, res) => {
  const reports = await reportService.getReports(req.query);
  successResponse(res, reports);
}));

router.post('/users/:reportId/review', authenticate, requireModerator, validateBody(reviewSchema), asyncHandler(async (req, res) => {
  await reportService.reviewReport('user', parseInt(req.params.reportId, 10), req.user.id, req.body.action, req.body.note);
  successResponse(res, null, 'Report reviewed');
}));

router.post('/listings/:reportId/review', authenticate, requireModerator, validateBody(reviewSchema), asyncHandler(async (req, res) => {
  await reportService.reviewReport('listing', parseInt(req.params.reportId, 10), req.user.id, req.body.action, req.body.note);
  successResponse(res, null, 'Report reviewed');
}));

module.exports = router;