// ===========================================
// DESIGNERS MODULE - ROUTES
// File: src/modules/designers/designers.routes.js
// ===========================================

const express = require('express');
const router = express.Router();

const designersController = require('./designers.controller');
const { authenticate, optionalAuth } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');
const {
  validateDesigner,
  validateDesignerUpdate,
  validatePortfolio
} = require('./designers.validation');

// ===========================================
// PUBLIC ROUTES
// ===========================================

/**
 * GET /api/designers
 */
router.get('/', designersController.getAllDesigners);

/**
 * GET /api/designers/location/nearby
 */
router.get('/location/nearby', designersController.getNearbyDesigners);

// ===========================================
// AUTHENTICATED DESIGNER ROUTES (STATIC)
// ===========================================

/**
 * GET /api/designers/me/profile
 */
router.get('/me/profile', authenticate, designersController.getMyDesignerProfile);

/**
 * POST /api/designers
 */
router.post('/', authenticate, validateDesigner, designersController.createDesigner);

// ===========================================
// ADMIN ROUTES (STATIC)
// ===========================================

/**
 * GET /api/designers/admin/all
 */
router.get('/admin/all', authenticate, requireAdmin, designersController.adminGetAllDesigners);

// ===========================================
// DYNAMIC DESIGNER ROUTES (ID BASED)
// ===========================================

/**
 * GET /api/designers/:id
 */
router.get('/:id', optionalAuth, designersController.getDesignerById);

/**
 * PUT /api/designers/:id
 */
router.put('/:id', authenticate, validateDesignerUpdate, designersController.updateDesigner);

/**
 * DELETE /api/designers/:id
 */
router.delete('/:id', authenticate, designersController.deleteDesigner);

/**
 * GET /api/designers/:id/portfolio
 */
router.get('/:id/portfolio', designersController.getDesignerPortfolio);

/**
 * POST /api/designers/:id/portfolio
 */
router.post('/:id/portfolio', authenticate, validatePortfolio, designersController.addPortfolioItem);

/**
 * PUT /api/designers/:id/portfolio/:portfolioId
 */
router.put('/:id/portfolio/:portfolioId', authenticate, designersController.updatePortfolioItem);

/**
 * DELETE /api/designers/:id/portfolio/:portfolioId
 */
router.delete('/:id/portfolio/:portfolioId', authenticate, designersController.deletePortfolioItem);

/**
 * GET /api/designers/:id/reviews
 */
router.get('/:id/reviews', designersController.getDesignerReviews);

/**
 * GET /api/designers/:id/availability
 */
router.get('/:id/availability', designersController.getDesignerAvailability);

/**
 * PUT /api/designers/:id/availability
 */
router.put('/:id/availability', authenticate, designersController.updateAvailability);

// ===========================================
// ADMIN ACTIONS (DYNAMIC)
// ===========================================

/**
 * PATCH /api/designers/:id/verify
 */
router.patch('/:id/verify', authenticate, requireAdmin, designersController.verifyDesigner);

/**
 * PATCH /api/designers/:id/feature
 */
router.patch('/:id/feature', authenticate, requireAdmin, designersController.featureDesigner);

/**
 * PATCH /api/designers/:id/status
 */
router.patch('/:id/status', authenticate, requireAdmin, designersController.updateDesignerStatus);

module.exports = router;
