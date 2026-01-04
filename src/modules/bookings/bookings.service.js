// ===========================================
// BOOKINGS MODULE - SERVICE
// File: src/modules/bookings/bookings.service.js
// ===========================================

const { prisma } = require('../../config/database');
const notificationService = require('../../utils/notification');

// ===========================================
// CONSTANTS
// ===========================================

const BOOKING_SELECT = {
  id: true,
  designerId: true,
  userId: true,
  dateTime: true,
  duration: true,
  endTime: true,
  bookingType: true,
  status: true,
  userNotes: true,
  designerNotes: true,
  meetingType: true,
  meetingLocation: true,
  meetingLink: true,
  fee: true,
  currency: true,
  isPaid: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  rejectionReason: true,
  createdAt: true,
  designer: {
    select: {
      id: true,
      userId: true,
      location: true,
      hourlyRate: true,
      consultationFee: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true
    }
  }
};

// ===========================================
// HELPER METHODS
// ===========================================

const getDesignerByUserId = async (userId) => {
  return prisma.designer.findFirst({
    where: { userId, isDeleted: false },
    select: { id: true, userId: true, consultationFee: true, currency: true }
  });
};

const getDesignerForBooking = async (designerId) => {
  return prisma.designer.findFirst({
    where: { id: designerId, isDeleted: false, isActive: true, isAvailable: true },
    select: {
      id: true,
      userId: true,
      consultationFee: true,
      hourlyRate: true,
      currency: true,
      availableDays: true,
      availableTimeStart: true,
      availableTimeEnd: true,
      user: { select: { id: true, name: true, email: true } }
    }
  });
};

const checkSlotAvailability = async (designerId, dateTime, duration, excludeBookingId = null) => {
  const endTime = new Date(dateTime.getTime() + duration * 60000);
  const where = {
    designerId,
    status: { in: ['pending', 'confirmed'] },
    OR: [
      { AND: [{ dateTime: { lte: dateTime } }, { endTime: { gt: dateTime } }] },
      { AND: [{ dateTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
      { AND: [{ dateTime: { gte: dateTime } }, { endTime: { lte: endTime } }] }
    ]
  };
  if (excludeBookingId) where.id = { not: excludeBookingId };
  const conflicting = await prisma.designerBooking.count({ where });
  return conflicting === 0;
};

// ===========================================
// USER BOOKING METHODS
// ===========================================

const getUserBookings = async (userId, { page, limit, status, type }) => {
  const skip = (page - 1) * limit;
  let where = {};

  if (type === 'as_user') {
    where.userId = userId;
  } else if (type === 'as_designer') {
    const designer = await getDesignerByUserId(userId);
    if (designer) where.designerId = designer.id;
    else return { bookings: [], pagination: { page, limit, total: 0, pages: 0 } };
  } else {
    const designer = await getDesignerByUserId(userId);
    where.OR = [{ userId }];
    if (designer) where.OR.push({ designerId: designer.id });
  }

  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.designerBooking.findMany({ where, select: BOOKING_SELECT, orderBy: { dateTime: 'desc' }, skip, take: limit }),
    prisma.designerBooking.count({ where })
  ]);

  return { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getBookingById = async (bookingId) => {
  return prisma.designerBooking.findUnique({
    where: { id: bookingId },
    select: { ...BOOKING_SELECT, review: { select: { id: true, rating: true, comment: true, createdAt: true } } }
  });
};

const createBooking = async (data, designer) => {
  const endTime = new Date(data.dateTime.getTime() + data.duration * 60000);
  const booking = await prisma.designerBooking.create({
    data: {
      designerId: data.designerId,
      userId: data.userId,
      dateTime: data.dateTime,
      duration: data.duration,
      endTime,
      bookingType: data.bookingType,
      userNotes: data.userNotes,
      meetingType: data.meetingType,
      meetingLocation: data.meetingLocation,
      fee: data.fee,
      currency: data.currency,
      status: 'pending'
    },
    select: BOOKING_SELECT
  });

  await notificationService.createNotification({
    userId: designer.userId,
    type: 'booking_request',
    title: 'New Booking Request',
    message: `You have a new booking request for ${data.dateTime.toLocaleDateString()}`,
    data: { bookingId: booking.id }
  });

  return booking;
};

const updateBooking = async (bookingId, data) => {
  const updateData = {};
  if (data.dateTime) {
    updateData.dateTime = data.dateTime;
    const duration = data.duration || (await prisma.designerBooking.findUnique({ where: { id: bookingId } })).duration;
    updateData.endTime = new Date(data.dateTime.getTime() + duration * 60000);
    updateData.status = 'pending';
    updateData.confirmedAt = null;
  }
  if (data.duration !== undefined) {
    updateData.duration = data.duration;
    if (!data.dateTime) {
      const booking = await prisma.designerBooking.findUnique({ where: { id: bookingId } });
      updateData.endTime = new Date(booking.dateTime.getTime() + data.duration * 60000);
    }
  }
  if (data.userNotes !== undefined) updateData.userNotes = data.userNotes;
  if (data.meetingType !== undefined) updateData.meetingType = data.meetingType;
  if (data.meetingLocation !== undefined) updateData.meetingLocation = data.meetingLocation;

  return prisma.designerBooking.update({ where: { id: bookingId }, data: updateData, select: BOOKING_SELECT });
};

const cancelBooking = async (bookingId, { cancelledBy, reason }) => {
  const booking = await prisma.designerBooking.update({
    where: { id: bookingId },
    data: { status: 'cancelled', cancelledBy, cancelledAt: new Date(), cancellationReason: reason },
    select: BOOKING_SELECT
  });

  const notifyUserId = cancelledBy === booking.userId ? booking.designer.userId : booking.userId;
  await notificationService.createNotification({
    userId: notifyUserId,
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: `A booking has been cancelled${reason ? `: ${reason}` : ''}`,
    data: { bookingId: booking.id }
  });

  return booking;
};

// ===========================================
// DESIGNER BOOKING METHODS
// ===========================================

const getDesignerBookings = async (designerId, { page, limit, status, upcoming }) => {
  const skip = (page - 1) * limit;
  const where = { designerId };
  if (status) where.status = status;
  if (upcoming) {
    where.dateTime = { gte: new Date() };
    where.status = { in: ['pending', 'confirmed'] };
  }

  const [bookings, total] = await Promise.all([
    prisma.designerBooking.findMany({ where, select: BOOKING_SELECT, orderBy: { dateTime: upcoming ? 'asc' : 'desc' }, skip, take: limit }),
    prisma.designerBooking.count({ where })
  ]);

  return { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const acceptBooking = async (bookingId, { designerNotes, meetingLink }) => {
  const booking = await prisma.designerBooking.update({
    where: { id: bookingId },
    data: { status: 'confirmed', confirmedAt: new Date(), designerNotes, meetingLink },
    select: BOOKING_SELECT
  });

  await notificationService.createNotification({
    userId: booking.userId,
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    message: `Your booking for ${booking.dateTime.toLocaleDateString()} has been confirmed`,
    data: { bookingId: booking.id }
  });

  return booking;
};

const rejectBooking = async (bookingId, reason) => {
  const booking = await prisma.designerBooking.update({
    where: { id: bookingId },
    data: { status: 'rejected', rejectionReason: reason },
    select: BOOKING_SELECT
  });

  await notificationService.createNotification({
    userId: booking.userId,
    type: 'booking_rejected',
    title: 'Booking Rejected',
    message: `Your booking request has been rejected: ${reason}`,
    data: { bookingId: booking.id }
  });

  return booking;
};

const completeBooking = async (bookingId) => {
  const booking = await prisma.designerBooking.update({
    where: { id: bookingId },
    data: { status: 'completed', completedAt: new Date() },
    select: BOOKING_SELECT
  });

  await prisma.designer.update({
    where: { id: booking.designerId },
    data: { completedProjects: { increment: 1 } }
  });

  await notificationService.createNotification({
    userId: booking.userId,
    type: 'booking_completed',
    title: 'Booking Completed',
    message: 'Your consultation is complete. Please leave a review!',
    data: { bookingId: booking.id }
  });

  return booking;
};

const markNoShow = async (bookingId) => {
  return prisma.designerBooking.update({
    where: { id: bookingId },
    data: { status: 'no_show' },
    select: BOOKING_SELECT
  });
};

// ===========================================
// REVIEW METHODS
// ===========================================

const getReviewByBookingId = async (bookingId) => {
  return prisma.designerReview.findUnique({ where: { bookingId } });
};

const createReview = async (data) => {
  const review = await prisma.designerReview.create({
    data: {
      designerId: data.designerId,
      userId: data.userId,
      bookingId: data.bookingId,
      rating: data.rating,
      communicationRating: data.communicationRating,
      professionalismRating: data.professionalismRating,
      qualityRating: data.qualityRating,
      valueRating: data.valueRating,
      title: data.title,
      comment: data.comment,
      photos: data.photos || []
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } }
  });

  await updateDesignerRating(data.designerId);

  const designer = await prisma.designer.findUnique({ where: { id: data.designerId } });
  await notificationService.createNotification({
    userId: designer.userId,
    type: 'new_review',
    title: 'New Review',
    message: `You received a ${data.rating}-star review`,
    data: { reviewId: review.id }
  });

  return review;
};

const respondToReview = async (reviewId, response) => {
  return prisma.designerReview.update({
    where: { id: reviewId },
    data: { response, respondedAt: new Date() }
  });
};

const updateDesignerRating = async (designerId) => {
  const stats = await prisma.designerReview.aggregate({
    where: { designerId, isApproved: true, isHidden: false },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.designer.update({
    where: { id: designerId },
    data: { rating: stats._avg.rating || 0, totalReviews: stats._count.rating }
  });
};

// ===========================================
// ADMIN METHODS
// ===========================================

const adminGetAllBookings = async ({ page, limit, status, designerId, userId }) => {
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (designerId) where.designerId = designerId;
  if (userId) where.userId = userId;

  const [bookings, total] = await Promise.all([
    prisma.designerBooking.findMany({ where, select: BOOKING_SELECT, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.designerBooking.count({ where })
  ]);

  return { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getBookingStats = async (days) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [total, pending, confirmed, completed, cancelled, revenue] = await Promise.all([
    prisma.designerBooking.count({ where: { createdAt: { gte: startDate } } }),
    prisma.designerBooking.count({ where: { status: 'pending', createdAt: { gte: startDate } } }),
    prisma.designerBooking.count({ where: { status: 'confirmed', createdAt: { gte: startDate } } }),
    prisma.designerBooking.count({ where: { status: 'completed', createdAt: { gte: startDate } } }),
    prisma.designerBooking.count({ where: { status: 'cancelled', createdAt: { gte: startDate } } }),
    prisma.designerBooking.aggregate({ where: { status: 'completed', isPaid: true, createdAt: { gte: startDate } }, _sum: { fee: true } })
  ]);

  return {
    period: `${days} days`,
    totalBookings: total,
    pendingBookings: pending,
    confirmedBookings: confirmed,
    completedBookings: completed,
    cancelledBookings: cancelled,
    totalRevenue: revenue._sum.fee || 0,
    completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
    cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(2) : 0
  };
};

const adminUpdateBookingStatus = async (bookingId, status) => {
  return prisma.designerBooking.update({ where: { id: bookingId }, data: { status }, select: BOOKING_SELECT });
};

const getPendingReviews = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const where = { isApproved: false, isHidden: false };

  const [reviews, total] = await Promise.all([
    prisma.designerReview.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        designer: { select: { id: true, user: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.designerReview.count({ where })
  ]);

  return { reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const moderateReview = async (reviewId, { action, reason, moderatorId }) => {
  const data = {};
  if (action === 'approve') {
    data.isApproved = true;
    data.approvedAt = new Date();
    data.approvedBy = moderatorId;
  } else if (action === 'reject' || action === 'hide') {
    data.isHidden = true;
    data.hiddenReason = reason;
  }

  const review = await prisma.designerReview.update({ where: { id: reviewId }, data });
  if (action === 'approve') await updateDesignerRating(review.designerId);
  return review;
};

module.exports = {
  getDesignerByUserId,
  getDesignerForBooking,
  checkSlotAvailability,
  getUserBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  getDesignerBookings,
  acceptBooking,
  rejectBooking,
  completeBooking,
  markNoShow,
  getReviewByBookingId,
  createReview,
  respondToReview,
  adminGetAllBookings,
  getBookingStats,
  adminUpdateBookingStatus,
  getPendingReviews,
  moderateReview
};