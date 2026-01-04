// ===========================================
// BOOKINGS MODULE - ROUTES
// File: src/modules/bookings/bookings.routes.js
// ===========================================

const express = require('express');
const router = express.Router();
const bookingsController = require('./bookings.controller');
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate, optionalAuth } = require('../../middleware/authMiddleware');

const {
  requireAdmin,
  requireModerator,
  requireAdminOrModerator, // ✅ ADD THIS
} = require('../../middleware/roleMiddleware');

const { generateTokenPair } = require('../../utils/token');
const { setMaintenanceMode } = require('../../middleware/maintenanceMode');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');
const { comparePassword } = require('../../utils/crypto');
const { getDeviceInfo } = require('../../middleware/deviceTracking');
const { validateBooking, validateReview } = require('../designers/designers.validation');

// ===========================================
// USER BOOKING ROUTES
// ===========================================

/**
 * GET /api/bookings
 * List all bookings for authenticated user
 * Query: ?status=pending&page=1&limit=20
 */
router.get('/', authenticate, bookingsController.getMyBookings);

/**
 * GET /api/bookings/:bookingId
 * Fetch details of a specific booking
 */
router.get('/:bookingId', authenticate, bookingsController.getBookingById);

/**
 * POST /api/designers/:designerId/bookings
 * User submits consultation booking request
 */
router.post('/designers/:designerId', authenticate, validateBooking, bookingsController.createBooking);

/**
 * PUT /api/bookings/:bookingId
 * Update booking details like rescheduling (owner only)
 */
router.put('/:bookingId', authenticate, bookingsController.updateBooking);

/**
 * POST /api/bookings/:bookingId/cancel
 * User or designer cancels booking
 */
router.post('/:bookingId/cancel', authenticate, bookingsController.cancelBooking);

// ===========================================
// DESIGNER BOOKING ROUTES
// ===========================================

/**
 * GET /api/bookings/designer/my
 * List bookings for designer's own profile
 */
router.get('/designer/my', authenticate, bookingsController.getDesignerBookings);

/**
 * GET /api/designers/:designerId/bookings
 * List bookings for specific designer (designer only)
 */
router.get('/designers/:designerId/list', authenticate, bookingsController.getDesignerBookingsById);

/**
 * POST /api/bookings/:bookingId/accept
 * Designer accepts booking (status: confirmed)
 */
router.post('/:bookingId/accept', authenticate, bookingsController.acceptBooking);

// ===========================================
// ADMIN APPROVE / REJECT BOOKING
// ===========================================


/**
 * POST /api/bookings/:bookingId/reject
 * Designer rejects booking (status: rejected)
 */
router.post('/:bookingId/reject', authenticate, bookingsController.rejectBooking);

/**
 * POST /api/bookings/:bookingId/complete
 * Designer marks booking as completed
 */
router.post('/:bookingId/complete', authenticate, bookingsController.completeBooking);

/**
 * POST /api/bookings/:bookingId/no-show
 * Designer marks booking as no-show
 */
router.post('/:bookingId/no-show', authenticate, bookingsController.markNoShow);

// ===========================================
// REVIEW ROUTES
// ===========================================

/**
 * POST /api/bookings/:bookingId/review
 * User submits review after completed booking
 */
router.post('/:bookingId/review', authenticate, validateReview, bookingsController.createReview);

/**
 * POST /api/bookings/:bookingId/review/response
 * Designer responds to review
 */
router.post('/:bookingId/review/response', authenticate, bookingsController.respondToReview);

// ===========================================
// ADMIN ROUTES
// ===========================================

/**
 * GET /api/bookings/admin/all
 * Get all bookings - Admin only
 */
router.get('/admin/all', authenticate, requireAdmin, bookingsController.adminGetAllBookings);

/**
 * GET /api/bookings/admin/stats
 * Get booking statistics - Admin only
 */
router.get('/admin/stats', authenticate, requireAdmin, bookingsController.getBookingStats);

/**
 * PATCH /api/bookings/admin/:bookingId/status
 * Admin update booking status
 */
router.patch('/admin/:bookingId/status', authenticate, requireAdmin, bookingsController.adminUpdateBookingStatus);

/**
 * GET /api/bookings/admin/reviews
 * Get pending reviews for moderation - Admin only
 */
router.get('/admin/reviews', authenticate, requireAdminOrModerator, bookingsController.getPendingReviews);

/**
 * PATCH /api/bookings/admin/reviews/:reviewId
 * Approve or reject review - Admin only
 */
router.patch('/admin/reviews/:reviewId', authenticate, requireAdminOrModerator, bookingsController.moderateReview);

module.exports = router;