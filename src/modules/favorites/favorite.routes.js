// ===========================================
// FAVORITES ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { favoriteService } = require('./favorite.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { validateQuery, Joi } = require('../../middleware/validation');

// Validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Get user's favorites
router.get(
  '/',
  authenticate,
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const result = await favoriteService.getFavorites(req.user.id, req.query);
    paginatedResponse(res, result);
  })
);

// Add to favorites
router.post(
  '/:listingId',
  authenticate,
  asyncHandler(async (req, res) => {
    const favorite = await favoriteService.addFavorite(
      req.user.id,
      parseInt(req.params.listingId, 10)
    );
    createdResponse(res, favorite, 'Added to favorites');
  })
);

// Remove from favorites
router.delete(
  '/:listingId',
  authenticate,
  asyncHandler(async (req, res) => {
    await favoriteService.removeFavorite(
      req.user.id,
      parseInt(req.params.listingId, 10)
    );
    successResponse(res, null, 'Removed from favorites');
  })
);

// Check if favorited
router.get(
  '/:listingId/check',
  authenticate,
  asyncHandler(async (req, res) => {
    const isFavorited = await favoriteService.isFavorited(
      req.user.id,
      parseInt(req.params.listingId, 10)
    );
    successResponse(res, { isFavorited });
  })
);

module.exports = router;