// ===========================================
// MODERATION ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { moderationService } = require('./moderation.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireModerator } = require('../../middleware/roleMiddleware');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');

// Validation schemas
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  itemType: Joi.string().valid('listing', 'user', 'comment'),
  assignedTo: Joi.number().integer().positive(),
});

const approveSchema = Joi.object({
  comment: Joi.string().max(500),
});

const rejectSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
  comment: Joi.string().max(500),
});

const changesSchema = Joi.object({
  changes: Joi.string().min(10).max(1000).required(),
  comment: Joi.string().max(500),
});

const assignSchema = Joi.object({
  moderatorId: Joi.number().integer().positive().required(),
});

// All routes require authentication and moderator role
router.use(authenticate, requireModerator);

// Get pending items
router.get(
  '/pending',
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const result = await moderationService.getPendingItems(req.query);
    paginatedResponse(res, result);
  })
);

// Get moderation stats
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await moderationService.getStats();
    successResponse(res, stats);
  })
);

// Approve item
router.post(
  '/:id/approve',
  validateBody(approveSchema),
  asyncHandler(async (req, res) => {
    await moderationService.approveItem(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.comment
    );
    successResponse(res, null, 'Item approved');
  })
);

// Reject item
router.post(
  '/:id/reject',
  validateBody(rejectSchema),
  asyncHandler(async (req, res) => {
    await moderationService.rejectItem(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.reason,
      req.body.comment
    );
    successResponse(res, null, 'Item rejected');
  })
);

// Request changes
router.post(
  '/:id/needs-changes',
  validateBody(changesSchema),
  asyncHandler(async (req, res) => {
    await moderationService.requestChanges(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.changes,
      req.body.comment
    );
    successResponse(res, null, 'Changes requested');
  })
);

// Assign to moderator
router.post(
  '/:id/assign',
  validateBody(assignSchema),
  asyncHandler(async (req, res) => {
    await moderationService.assignToModerator(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.moderatorId
    );
    successResponse(res, null, 'Item assigned');
  })
);

module.exports = router;