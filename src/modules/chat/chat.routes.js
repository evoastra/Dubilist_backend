// ===========================================
// CHAT ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { chatService } = require('./chat.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { chatRateLimiter } = require('../../middleware/rateLimiter');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');

// Validation schemas
const createRoomSchema = Joi.object({
  listingId: Joi.number().integer().positive().required(),
});

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  attachment: Joi.string().uri(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  before: Joi.string().isoDate(),
});

const searchSchema = Joi.object({
  q: Joi.string().min(1).max(200).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Get user's chat rooms
router.get(
  '/rooms',
  authenticate,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const result = await chatService.getUserRooms(req.user.id, req.query);
    paginatedResponse(res, result);
  })
);

// Create or get chat room
router.post(
  '/rooms',
  authenticate,
  validateBody(createRoomSchema),
  asyncHandler(async (req, res) => {
    const room = await chatService.getOrCreateRoom(req.user.id, req.body.listingId);
    successResponse(res, room);
  })
);

// Get room messages
router.get(
  '/rooms/:id/messages',
  authenticate,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const result = await chatService.getRoomMessages(
      parseInt(req.params.id, 10),
      req.user.id,
      req.query
    );
    paginatedResponse(res, result);
  })
);

// Send message
router.post(
  '/rooms/:id/messages',
  authenticate,
  chatRateLimiter,
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const message = await chatService.sendMessage(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.content,
      req.body.attachment
    );
    createdResponse(res, message, 'Message sent');
  })
);

// Delete message
router.delete(
  '/messages/:messageId',
  authenticate,
  asyncHandler(async (req, res) => {
    await chatService.deleteMessage(
      parseInt(req.params.messageId, 10),
      req.user.id
    );
    successResponse(res, null, 'Message deleted');
  })
);

// Block chat room
router.post(
  '/rooms/:id/block',
  authenticate,
  asyncHandler(async (req, res) => {
    await chatService.blockRoom(parseInt(req.params.id, 10), req.user.id);
    successResponse(res, null, 'Chat blocked');
  })
);

// Unblock chat room
router.post(
  '/rooms/:id/unblock',
  authenticate,
  asyncHandler(async (req, res) => {
    await chatService.unblockRoom(parseInt(req.params.id, 10), req.user.id);
    successResponse(res, null, 'Chat unblocked');
  })
);

// Search messages
router.get(
  '/search',
  authenticate,
  validateQuery(searchSchema),
  asyncHandler(async (req, res) => {
    const result = await chatService.searchMessages(
      req.user.id,
      req.query.q,
      req.query
    );
    paginatedResponse(res, result);
  })
);

module.exports = router;