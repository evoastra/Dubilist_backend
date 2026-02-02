// ===========================================
// BOOKINGS MODULE - CONTROLLER
// File: src/modules/bookings/bookings.controller.js
// ===========================================

const bookingsService = require('./bookings.service');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

// ===========================================
// USER BOOKING METHODS
// ===========================================

/**
 * GET /api/bookings
 * Get user's bookings
 */
const getMyBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type = 'all'
    } = req.query;

    const result = await bookingsService.getUserBookings(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type
    });

    return sendPaginated(res, result.bookings, result.pagination);
  } catch (error) {
    console.error('Get my bookings error:', error);
    return sendError(res, 'Failed to get bookings', 500);
  }
};

/**
 * GET /api/bookings/:bookingId
 * Get booking details
 */
const getBookingById = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.userId !== req.user.id && booking.designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to view this booking', 403);
    }

    return sendSuccess(res, booking);
  } catch (error) {
    console.error('Get booking error:', error);
    return sendError(res, 'Failed to get booking', 500);
  }
};

/**
 * POST /api/designers/:designerId/bookings
 * Create new booking
 */
const createBooking = async (req, res) => {
  try {
    const designerId = parseInt(req.params.designerId);

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const designer = await bookingsService.getDesignerForBooking(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found or not available', 404);
    }

    if (designer.userId === req.user.id) {
      return sendError(res, 'Cannot book your own services', 400);
    }

    const isAvailable = await bookingsService.checkSlotAvailability(
      designerId,
      new Date(req.body.dateTime),
      req.body.duration || 60
    );

    if (!isAvailable) {
      return sendError(res, 'This time slot is not available', 409);
    }

    const bookingData = {
      designerId,
      userId: req.user.id,
      dateTime: new Date(req.body.dateTime),
      duration: req.body.duration || 60,
      bookingType: req.body.bookingType || 'consultation',
      userNotes: req.body.notes,
      userName: req.body.userName || req.body.user_name || req.user.name,
  userAddress: req.body.userAddress || req.body.user_address,
  userPhone: req.body.userPhone || req.body.user_phone || req.user.phone,
   projectType: req.body.projectType || req.body.project_type,
  projectDescription: req.body.projectDescription || req.body.project_description,
      meetingType: req.body.meetingType,
      meetingLocation: req.body.meetingLocation,
      fee: designer.consultationFee,
      currency: designer.currency
    };

    const booking = await bookingsService.createBooking(bookingData, designer);

    return sendSuccess(res, booking, 'Booking request submitted successfully', 201);
  } catch (error) {
    console.error('Create booking error:', error);
    return sendError(res, 'Failed to create booking', 500);
  }
};

/**
 * PUT /api/bookings/:bookingId
 * Update booking (reschedule)
 */
const updateBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.userId !== req.user.id) {
      return sendError(res, 'Not authorized to update this booking', 403);
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return sendError(res, 'Cannot update this booking', 400);
    }

    if (req.body.dateTime) {
      const isAvailable = await bookingsService.checkSlotAvailability(
        booking.designerId,
        new Date(req.body.dateTime),
        req.body.duration || booking.duration,
        bookingId
      );

      if (!isAvailable) {
        return sendError(res, 'This time slot is not available', 409);
      }
    }

    const updated = await bookingsService.updateBooking(bookingId, {
      dateTime: req.body.dateTime ? new Date(req.body.dateTime) : undefined,
      duration: req.body.duration,
      userNotes: req.body.notes,
      meetingType: req.body.meetingType,
       userName: req.body.userName || req.body.user_name,
  userAddress: req.body.userAddress || req.body.user_address,
  userPhone: req.body.userPhone || req.body.user_phone,
  

  
  // ✅ NEW FIELDS - Allow updating project details
  projectType: req.body.projectType || req.body.project_type,
  projectDescription: req.body.projectDescription || req.body.project_description,
      meetingLocation: req.body.meetingLocation
    });

    return sendSuccess(res, updated, 'Booking updated successfully');
  } catch (error) {
    console.error('Update booking error:', error);
    return sendError(res, 'Failed to update booking', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/cancel
 * Cancel booking
 */
const cancelBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const isUser = booking.userId === req.user.id;
    const isDesigner = booking.designer.userId === req.user.id;

    if (!isUser && !isDesigner && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to cancel this booking', 403);
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return sendError(res, 'Cannot cancel this booking', 400);
    }

    const cancelled = await bookingsService.cancelBooking(bookingId, {
      cancelledBy: req.user.id,
      reason: req.body.reason
    });

    return sendSuccess(res, cancelled, 'Booking cancelled successfully');
  } catch (error) {
    console.error('Cancel booking error:', error);
    return sendError(res, 'Failed to cancel booking', 500);
  }
};

// ===========================================
// DESIGNER BOOKING METHODS
// ===========================================

/**
 * GET /api/bookings/designer/my
 * Get designer's bookings
 */
const getDesignerBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, upcoming } = req.query;

    const designer = await bookingsService.getDesignerByUserId(req.user.id);
    if (!designer) {
      return sendError(res, 'You do not have a designer profile', 404);
    }

    const result = await bookingsService.getDesignerBookings(designer.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      upcoming: upcoming === 'true'
    });

    return sendPaginated(res, result.bookings, result.pagination);
  } catch (error) {
    console.error('Get designer bookings error:', error);
    return sendError(res, 'Failed to get bookings', 500);
  }
};

/**
 * GET /api/designers/:designerId/bookings
 * Get bookings for specific designer
 */
const getDesignerBookingsById = async (req, res) => {
  try {
    const designerId = parseInt(req.params.designerId);
    const { page = 1, limit = 20, status } = req.query;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const designer = await bookingsService.getDesignerByUserId(req.user.id);
    if (!designer || designer.id !== designerId) {
      if (req.user.role.name !== 'admin') {
        return sendError(res, 'Not authorized to view these bookings', 403);
      }
    }

    const result = await bookingsService.getDesignerBookings(designerId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    return sendPaginated(res, result.bookings, result.pagination);
  } catch (error) {
    console.error('Get designer bookings error:', error);
    return sendError(res, 'Failed to get bookings', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/accept
 * Designer accepts booking
 */
const acceptBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.designer.userId !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status !== 'pending') {
      return sendError(res, 'Can only accept pending bookings', 400);
    }

    const accepted = await bookingsService.acceptBooking(bookingId, {
      designerNotes: req.body.notes,
      meetingLink: req.body.meetingLink
    });

    return sendSuccess(res, accepted, 'Booking confirmed successfully');
  } catch (error) {
    console.error('Accept booking error:', error);
    return sendError(res, 'Failed to accept booking', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/reject
 * Designer rejects booking
 */
const rejectBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.designer.userId !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status !== 'pending') {
      return sendError(res, 'Can only reject pending bookings', 400);
    }

    if (!req.body.reason) {
      return sendError(res, 'Rejection reason is required', 400);
    }

    const rejected = await bookingsService.rejectBooking(bookingId, req.body.reason);

    return sendSuccess(res, rejected, 'Booking rejected');
  } catch (error) {
    console.error('Reject booking error:', error);
    return sendError(res, 'Failed to reject booking', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/complete
 * Designer marks booking as completed
 */
const completeBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.designer.userId !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status !== 'confirmed') {
      return sendError(res, 'Can only complete confirmed bookings', 400);
    }

    const completed = await bookingsService.completeBooking(bookingId);

    return sendSuccess(res, completed, 'Booking marked as completed');
  } catch (error) {
    console.error('Complete booking error:', error);
    return sendError(res, 'Failed to complete booking', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/no-show
 * Designer marks booking as no-show
 */
const markNoShow = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.designer.userId !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    if (booking.status !== 'confirmed') {
      return sendError(res, 'Can only mark confirmed bookings as no-show', 400);
    }

    const noShow = await bookingsService.markNoShow(bookingId);

    return sendSuccess(res, noShow, 'Booking marked as no-show');
  } catch (error) {
    console.error('Mark no-show error:', error);
    return sendError(res, 'Failed to mark no-show', 500);
  }
};

// ===========================================
// REVIEW METHODS
// ===========================================

/**
 * POST /api/bookings/:bookingId/review
 * Create review for completed booking
 */
const createReview = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const booking = await bookingsService.getBookingById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.userId !== req.user.id) {
      return sendError(res, 'Not authorized to review this booking', 403);
    }

    if (booking.status !== 'completed') {
      return sendError(res, 'Can only review completed bookings', 400);
    }

    const existingReview = await bookingsService.getReviewByBookingId(bookingId);
    if (existingReview) {
      return sendError(res, 'You have already reviewed this booking', 409);
    }

    const reviewData = {
      designerId: booking.designerId,
      userId: req.user.id,
      bookingId,
      rating: parseInt(req.body.rating),
      communicationRating: req.body.communicationRating ? parseInt(req.body.communicationRating) : null,
      professionalismRating: req.body.professionalismRating ? parseInt(req.body.professionalismRating) : null,
      qualityRating: req.body.qualityRating ? parseInt(req.body.qualityRating) : null,
      valueRating: req.body.valueRating ? parseInt(req.body.valueRating) : null,
      title: req.body.title,
      comment: req.body.comment,
      photos: req.body.photos
    };

    const review = await bookingsService.createReview(reviewData);

    return sendSuccess(res, review, 'Review submitted successfully', 201);
  } catch (error) {
    console.error('Create review error:', error);
    return sendError(res, 'Failed to create review', 500);
  }
};

/**
 * POST /api/bookings/:bookingId/review/response
 * Designer responds to review
 */
const respondToReview = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const review = await bookingsService.getReviewByBookingId(bookingId);
    if (!review) {
      return sendError(res, 'Review not found', 404);
    }

    const designer = await bookingsService.getDesignerByUserId(req.user.id);
    if (!designer || designer.id !== review.designerId) {
      return sendError(res, 'Not authorized', 403);
    }

    if (!req.body.response) {
      return sendError(res, 'Response is required', 400);
    }

    const updated = await bookingsService.respondToReview(review.id, req.body.response);

    return sendSuccess(res, updated, 'Response added successfully');
  } catch (error) {
    console.error('Respond to review error:', error);
    return sendError(res, 'Failed to respond to review', 500);
  }
};

// ===========================================
// ADMIN METHODS
// ===========================================

/**
 * GET /api/bookings/admin/all
 * Get all bookings (Admin)
 */
const adminGetAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, designerId, userId } = req.query;

    const result = await bookingsService.adminGetAllBookings({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      designerId: designerId ? parseInt(designerId) : undefined,
      userId: userId ? parseInt(userId) : undefined
    });

    return sendPaginated(res, result.bookings, result.pagination);
  } catch (error) {
    console.error('Admin get bookings error:', error);
    return sendError(res, 'Failed to get bookings', 500);
  }
};

/**
 * GET /api/bookings/admin/stats
 * Get booking statistics
 */
const getBookingStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const stats = await bookingsService.getBookingStats(parseInt(days));

    return sendSuccess(res, stats);
  } catch (error) {
    console.error('Get booking stats error:', error);
    return sendError(res, 'Failed to get statistics', 500);
  }
};

/**
 * PATCH /api/bookings/admin/:bookingId/status
 * Admin update booking status
 */
const adminUpdateBookingStatus = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const { status } = req.body;

    if (isNaN(bookingId)) {
      return sendError(res, 'Invalid booking ID', 400);
    }

    const validStatuses = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    const updated = await bookingsService.adminUpdateBookingStatus(bookingId, status);

    return sendSuccess(res, updated, 'Booking status updated');
  } catch (error) {
    console.error('Admin update status error:', error);
    return sendError(res, 'Failed to update status', 500);
  }
};

/**
 * GET /api/bookings/admin/reviews
 * Get pending reviews for moderation
 */
const getPendingReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await bookingsService.getPendingReviews({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return sendPaginated(res, result.reviews, result.pagination);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    return sendError(res, 'Failed to get reviews', 500);
  }
};

/**
 * PATCH /api/bookings/admin/reviews/:reviewId
 * Moderate review (approve/reject)
 */
const moderateReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.reviewId);
    const { action, reason } = req.body;

    if (isNaN(reviewId)) {
      return sendError(res, 'Invalid review ID', 400);
    }

    if (!['approve', 'reject', 'hide'].includes(action)) {
      return sendError(res, 'Invalid action', 400);
    }

    const updated = await bookingsService.moderateReview(reviewId, {
      action,
      reason,
      moderatorId: req.user.id
    });

    return sendSuccess(res, updated, `Review ${action}d successfully`);
  } catch (error) {
    console.error('Moderate review error:', error);
    return sendError(res, 'Failed to moderate review', 500);
  }
};

module.exports = {
  getMyBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  getDesignerBookings,
  getDesignerBookingsById,
  acceptBooking,
  rejectBooking,
  completeBooking,
  markNoShow,
  createReview,
  respondToReview,
  adminGetAllBookings,
  getBookingStats,
  adminUpdateBookingStatus,
  getPendingReviews,
  moderateReview
};