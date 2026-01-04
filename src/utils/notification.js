// ===========================================
// NOTIFICATION UTILITY
// File: src/utils/notification.util.js
// Handles notification creation for the designer module
// ===========================================

const { prisma } = require('../config/database');

/**
 * Create a notification
 * @param {Object} data - Notification data
 * @param {number} data.userId - User to notify
 * @param {string} data.type - Notification type
 * @param {string} data.title - Notification title
 * @param {string} data.message - Notification message
 * @param {Object} data.data - Additional data (JSON)
 */
const createNotification = async ({ userId, type, title, message, data = {} }) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data
      }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw - notifications are non-critical
    return null;
  }
};

/**
 * Create multiple notifications (batch)
 * @param {Array} notifications - Array of notification objects
 */
const createNotifications = async (notifications) => {
  try {
    return await prisma.notification.createMany({
      data: notifications
    });
  } catch (error) {
    console.error('Failed to create notifications:', error);
    return null;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId
 * @param {number} userId - For authorization check
 */
const markAsRead = async (notificationId, userId) => {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId
 */
const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });
};

/**
 * Get unread notification count for a user
 * @param {number} userId
 */
const getUnreadCount = async (userId) => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });
};

/**
 * Notification type constants
 */
const NOTIFICATION_TYPES = {
  // Booking notifications
  BOOKING_REQUEST: 'booking_request',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_REJECTED: 'booking_rejected',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_REMINDER: 'booking_reminder',
  BOOKING_COMPLETED: 'booking_completed',
  
  // Review notifications
  NEW_REVIEW: 'new_review',
  REVIEW_RESPONSE: 'review_response',
  
  // Listing notifications (existing)
  LISTING_APPROVED: 'listing_approved',
  LISTING_REJECTED: 'listing_rejected',
  LISTING_EXPIRED: 'listing_expired',
  
  // Chat notifications (existing)
  NEW_MESSAGE: 'new_message',
  
  // Other
  PRICE_ALERT: 'price_alert',
  NEW_FAVORITE: 'new_favorite',
  SUPPORT_REPLY: 'support_reply',
  SYSTEM: 'system'
};

/**
 * Create booking-related notification
 */
const notifyBookingRequest = async (designerUserId, bookingId, dateTime) => {
  return createNotification({
    userId: designerUserId,
    type: NOTIFICATION_TYPES.BOOKING_REQUEST,
    title: 'New Booking Request',
    message: `You have a new consultation request for ${new Date(dateTime).toLocaleDateString()}`,
    data: { bookingId }
  });
};

const notifyBookingConfirmed = async (userId, bookingId, dateTime) => {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
    title: 'Booking Confirmed',
    message: `Your booking for ${new Date(dateTime).toLocaleDateString()} has been confirmed`,
    data: { bookingId }
  });
};

const notifyBookingRejected = async (userId, bookingId, reason) => {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.BOOKING_REJECTED,
    title: 'Booking Declined',
    message: `Your booking request has been declined. ${reason ? `Reason: ${reason}` : ''}`,
    data: { bookingId }
  });
};

const notifyBookingCancelled = async (userId, bookingId, dateTime) => {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.BOOKING_CANCELLED,
    title: 'Booking Cancelled',
    message: `A booking for ${new Date(dateTime).toLocaleDateString()} has been cancelled`,
    data: { bookingId }
  });
};

const notifyNewReview = async (designerUserId, reviewId, rating) => {
  return createNotification({
    userId: designerUserId,
    type: NOTIFICATION_TYPES.NEW_REVIEW,
    title: 'New Review Received',
    message: `You received a ${rating}-star review`,
    data: { reviewId }
  });
};

const notifyReviewResponse = async (userId, reviewId) => {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.REVIEW_RESPONSE,
    title: 'Designer Responded to Your Review',
    message: 'The designer has responded to your review',
    data: { reviewId }
  });
};

module.exports = {
  createNotification,
  createNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  NOTIFICATION_TYPES,
  notifyBookingRequest,
  notifyBookingConfirmed,
  notifyBookingRejected,
  notifyBookingCancelled,
  notifyNewReview,
  notifyReviewResponse
};
