// ===========================================
// FRAUD ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { fraudService } = require('./fraud.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');
const { validateQuery, Joi } = require('../../middleware/validation');

// Validation schemas
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid(
    'TOO_MANY_LISTINGS',
    'REPEATED_PHONE',
    'REPEATED_REJECTION',
    'MANY_DEVICES',
    'SUSPICIOUS_ACTIVITY',
    'HIGH_RISK_USER'
  ),
  minRiskScore: Joi.number().integer().min(0),
});

// All routes require admin
router.use(authenticate, requireAdmin);

// Get all fraud logs
router.get(
  '/logs',
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const result = await fraudService.getAllFraudLogs(req.query);
    paginatedResponse(res, result);
  })
);

// Get high-risk users
router.get(
  '/high-risk',
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const result = await fraudService.getHighRiskUsers(req.query);
    paginatedResponse(res, result);
  })
);

// Get fraud logs for specific user
router.get(
  '/users/:userId',
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const result = await fraudService.getUserFraudLogs(
      parseInt(req.params.userId, 10),
      req.query
    );
    paginatedResponse(res, result);
  })
);

// Mark fraud log as reviewed
router.post(
  '/logs/:id/review',
  asyncHandler(async (req, res) => {
    await fraudService.markAsReviewed(
      parseInt(req.params.id, 10),
      req.user.id
    );
    successResponse(res, null, 'Fraud log reviewed');
  })
);

module.exports = router;