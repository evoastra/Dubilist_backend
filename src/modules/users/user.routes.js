// ===========================================
// USER ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');
const { authenticate, optionalAuth } = require('../../middleware/authMiddleware');
const { trackDevice } = require('../../middleware/deviceTracking');
const { requireAdmin } = require('../../middleware/roleMiddleware');

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  phone: Joi.string().pattern(/^[+]?[\d\s-]+$/).min(8).max(20).allow(null, ''),
  bio: Joi.string().max(500).allow(null, ''),
  avatarUrl: Joi.string().uri().allow(null, ''),
  
});

const listingsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'pending', 'approved', 'rejected', 'sold', 'expired'),
});

// Protected routes for authenticated users 
router.get('/me', authenticate, trackDevice, userController.getMe);

router.put(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  userController.updateProfile
);

router.get('/me/listings', authenticate, validateQuery(listingsQuerySchema), userController.getMyListings);

router.get('/me/sessions', authenticate, userController.getSessions);

router.delete('/me/sessions/:id', authenticate, userController.deleteSession);

router.post('/me/deactivate', authenticate, userController.deactivateAccount);

router.get('/me/export', authenticate, userController.exportData);

// Public routes
router.get('/:id', optionalAuth, userController.getProfile);

module.exports = router;

