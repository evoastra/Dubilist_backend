// ===========================================
// DESIGNERS MODULE - CONTROLLER
// File: src/modules/designers/designers.controller.js
// ===========================================

const designersService = require('./designers.service');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

// ===========================================
// PUBLIC METHODS
// ===========================================

/**
 * GET /api/designers
 * List all available interior designers with filtering
 */
const getAllDesigners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      location,
      city,
      country,
      services,
      specializations,
      minRating,
      maxRate,
      minRate,
      isVerified,
      sortBy = 'rating',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      location,
      city,
      country,
      services: services ? services.split(',') : undefined,
      specializations: specializations ? specializations.split(',') : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      minRate: minRate ? parseFloat(minRate) : undefined,
      maxRate: maxRate ? parseFloat(maxRate) : undefined,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined
    };

    const result = await designersService.getAllDesigners({
      page: parseInt(page),
      limit: parseInt(limit),
      filters,
      sortBy,
      sortOrder
    });

    return sendPaginated(res, result.designers, result.pagination);
  } catch (error) {
    console.error('Get all designers error:', error);
    return sendError(res, 'Failed to get designers', 500);
  }
};

/**
 * GET /api/designers/:id
 * Get specific designer profile
 */
const getDesignerById = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    
    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const designer = await designersService.getDesignerById(designerId, req.user?.id);

    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    return sendSuccess(res, designer);
  } catch (error) {
    console.error('Get designer error:', error);
    return sendError(res, 'Failed to get designer', 500);
  }
};

/**
 * GET /api/designers/:id/portfolio
 * Get designer's portfolio
 */
const getDesignerPortfolio = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { page = 1, limit = 12, projectType } = req.query;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const result = await designersService.getDesignerPortfolio(designerId, {
      page: parseInt(page),
      limit: parseInt(limit),
      projectType
    });

    return sendPaginated(res, result.items, result.pagination);
  } catch (error) {
    console.error('Get portfolio error:', error);
    return sendError(res, 'Failed to get portfolio', 500);
  }
};

/**
 * GET /api/designers/:id/reviews
 * Get designer's reviews
 */
const getDesignerReviews = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { page = 1, limit = 10, sortBy = 'newest' } = req.query;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const result = await designersService.getDesignerReviews(designerId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy
    });

    return sendPaginated(res, result.reviews, result.pagination, { stats: result.stats });
  } catch (error) {
    console.error('Get reviews error:', error);
    return sendError(res, 'Failed to get reviews', 500);
  }
};

/**
 * GET /api/designers/location/nearby
 * Get designers near a location
 */
const getNearbyDesigners = async (req, res) => {
  try {
    const { latitude, longitude, radius = 50, page = 1, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return sendError(res, 'Latitude and longitude are required', 400);
    }

    const result = await designersService.getNearbyDesigners({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseInt(radius),
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return sendPaginated(res, result.designers, result.pagination);
  } catch (error) {
    console.error('Get nearby designers error:', error);
    return sendError(res, 'Failed to get nearby designers', 500);
  }
};

// ===========================================
// AUTHENTICATED USER METHODS
// ===========================================

/**
 * POST /api/designers
 * Create new designer profile
 */
const createDesigner = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has a designer profile
    const existingDesigner = await designersService.getDesignerByUserId(userId);
    if (existingDesigner) {
      return sendError(res, 'You already have a designer profile', 409);
    }

    const designerData = {
      userId,
      bio: req.body.bio,
      tagline: req.body.tagline,
      location: req.body.location,
      city: req.body.city,
      country: req.body.country,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      serviceRadius: req.body.serviceRadius,
      services: req.body.services,
      specializations: req.body.specializations,
      hourlyRate: req.body.hourlyRate,
      consultationFee: req.body.consultationFee,
      currency: req.body.currency,
      photos: req.body.photos,
      portfolioUrl: req.body.portfolioUrl,
      yearsExperience: req.body.yearsExperience,
      certifications: req.body.certifications,
      education: req.body.education,
      languages: req.body.languages,
      availableDays: req.body.availableDays,
      availableTimeStart: req.body.availableTimeStart,
      availableTimeEnd: req.body.availableTimeEnd
    };

    const designer = await designersService.createDesigner(designerData);

    return sendSuccess(res, designer, 'Designer profile created successfully', 201);
  } catch (error) {
    console.error('Create designer error:', error);
    return sendError(res, 'Failed to create designer profile', 500);
  }
};

/**
 * GET /api/designers/me/profile
 * Get current user's designer profile
 */
const getMyDesignerProfile = async (req, res) => {
  try {
    const designer = await designersService.getDesignerByUserId(req.user.id);

    if (!designer) {
      return sendError(res, 'You do not have a designer profile', 404);
    }

    return sendSuccess(res, designer);
  } catch (error) {
    console.error('Get my profile error:', error);
    return sendError(res, 'Failed to get designer profile', 500);
  }
};

/**
 * PUT /api/designers/:id
 * Update designer profile
 */
const updateDesigner = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    // Check ownership
    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to update this profile', 403);
    }

    const updateData = {
      bio: req.body.bio,
      tagline: req.body.tagline,
      location: req.body.location,
      city: req.body.city,
      country: req.body.country,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      serviceRadius: req.body.serviceRadius,
      services: req.body.services,
      specializations: req.body.specializations,
      hourlyRate: req.body.hourlyRate,
      consultationFee: req.body.consultationFee,
      currency: req.body.currency,
      photos: req.body.photos,
      portfolioUrl: req.body.portfolioUrl,
      yearsExperience: req.body.yearsExperience,
      certifications: req.body.certifications,
      education: req.body.education,
      languages: req.body.languages,
      availableDays: req.body.availableDays,
      availableTimeStart: req.body.availableTimeStart,
      availableTimeEnd: req.body.availableTimeEnd,
      isAvailable: req.body.isAvailable
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const updated = await designersService.updateDesigner(designerId, updateData);

    return sendSuccess(res, updated, 'Designer profile updated successfully');
  } catch (error) {
    console.error('Update designer error:', error);
    return sendError(res, 'Failed to update designer profile', 500);
  }
};

/**
 * DELETE /api/designers/:id
 * Soft delete designer profile
 */
const deleteDesigner = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to delete this profile', 403);
    }

    await designersService.deleteDesigner(designerId);

    return sendSuccess(res, null, 'Designer profile deleted successfully');
  } catch (error) {
    console.error('Delete designer error:', error);
    return sendError(res, 'Failed to delete designer profile', 500);
  }
};

// ===========================================
// PORTFOLIO METHODS
// ===========================================

/**
 * POST /api/designers/:id/portfolio
 * Add portfolio item
 */
const addPortfolioItem = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    // Check ownership
    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const portfolioData = {
      designerId,
      title: req.body.title,
      description: req.body.description,
      projectType: req.body.projectType,
      style: req.body.style,
      images: req.body.images,
      beforeImages: req.body.beforeImages,
      afterImages: req.body.afterImages,
      location: req.body.location,
      area: req.body.area,
      budget: req.body.budget,
      duration: req.body.duration,
      completedAt: req.body.completedAt,
      tags: req.body.tags
    };

    const item = await designersService.addPortfolioItem(portfolioData);

    return sendSuccess(res, item, 'Portfolio item added successfully', 201);
  } catch (error) {
    console.error('Add portfolio item error:', error);
    return sendError(res, 'Failed to add portfolio item', 500);
  }
};

/**
 * PUT /api/designers/:id/portfolio/:portfolioId
 * Update portfolio item
 */
const updatePortfolioItem = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const portfolioId = parseInt(req.params.portfolioId);

    if (isNaN(designerId) || isNaN(portfolioId)) {
      return sendError(res, 'Invalid ID', 400);
    }

    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await designersService.updatePortfolioItem(portfolioId, req.body);

    return sendSuccess(res, updated, 'Portfolio item updated successfully');
  } catch (error) {
    console.error('Update portfolio item error:', error);
    return sendError(res, 'Failed to update portfolio item', 500);
  }
};

/**
 * DELETE /api/designers/:id/portfolio/:portfolioId
 * Delete portfolio item
 */
const deletePortfolioItem = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const portfolioId = parseInt(req.params.portfolioId);

    if (isNaN(designerId) || isNaN(portfolioId)) {
      return sendError(res, 'Invalid ID', 400);
    }

    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    await designersService.deletePortfolioItem(portfolioId);

    return sendSuccess(res, null, 'Portfolio item deleted successfully');
  } catch (error) {
    console.error('Delete portfolio item error:', error);
    return sendError(res, 'Failed to delete portfolio item', 500);
  }
};

// ===========================================
// AVAILABILITY METHODS
// ===========================================

/**
 * GET /api/designers/:id/availability
 * Get designer's availability
 */
const getDesignerAvailability = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const availability = await designersService.getDesignerAvailability(designerId, {
      startDate,
      endDate
    });

    return sendSuccess(res, availability);
  } catch (error) {
    console.error('Get availability error:', error);
    return sendError(res, 'Failed to get availability', 500);
  }
};

/**
 * PUT /api/designers/:id/availability
 * Update availability settings
 */
const updateAvailability = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const designer = await designersService.getDesignerById(designerId);
    if (!designer) {
      return sendError(res, 'Designer not found', 404);
    }

    if (designer.userId !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await designersService.updateAvailability(designerId, {
      availableDays: req.body.availableDays,
      availableTimeStart: req.body.availableTimeStart,
      availableTimeEnd: req.body.availableTimeEnd,
      isAvailable: req.body.isAvailable
    });

    return sendSuccess(res, updated, 'Availability updated successfully');
  } catch (error) {
    console.error('Update availability error:', error);
    return sendError(res, 'Failed to update availability', 500);
  }
};

// ===========================================
// ADMIN METHODS
// ===========================================

/**
 * GET /api/designers/admin/all
 * Get all designers including inactive (Admin)
 */
const adminGetAllDesigners = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, isVerified, search } = req.query;

    const result = await designersService.adminGetAllDesigners({
      page: parseInt(page),
      limit: parseInt(limit),
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
      search
    });

    return sendPaginated(res, result.designers, result.pagination);
  } catch (error) {
    console.error('Admin get designers error:', error);
    return sendError(res, 'Failed to get designers', 500);
  }
};

/**
 * PATCH /api/designers/:id/verify
 * Verify designer (Admin)
 */
const verifyDesigner = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { isVerified } = req.body;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const updated = await designersService.verifyDesigner(designerId, isVerified, req.user.id);

    return sendSuccess(res, updated, isVerified ? 'Designer verified' : 'Designer verification removed');
  } catch (error) {
    console.error('Verify designer error:', error);
    return sendError(res, 'Failed to update verification', 500);
  }
};

/**
 * PATCH /api/designers/:id/feature
 * Feature/unfeature designer (Admin)
 */
const featureDesigner = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { isFeatured, featuredUntil } = req.body;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const updated = await designersService.featureDesigner(designerId, { 
      isFeatured, 
      featuredUntil 
    });

    return sendSuccess(res, updated, isFeatured ? 'Designer featured' : 'Designer unfeatured');
  } catch (error) {
    console.error('Feature designer error:', error);
    return sendError(res, 'Failed to update feature status', 500);
  }
};

/**
 * PATCH /api/designers/:id/status
 * Update designer status (Admin)
 */
const updateDesignerStatus = async (req, res) => {
  try {
    const designerId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(designerId)) {
      return sendError(res, 'Invalid designer ID', 400);
    }

    const updated = await designersService.updateDesignerStatus(designerId, isActive);

    return sendSuccess(res, updated, isActive ? 'Designer activated' : 'Designer deactivated');
  } catch (error) {
    console.error('Update status error:', error);
    return sendError(res, 'Failed to update status', 500);
  }
};

module.exports = {
  getAllDesigners,
  getDesignerById,
  getDesignerPortfolio,
  getDesignerReviews,
  getNearbyDesigners,
  createDesigner,
  getMyDesignerProfile,
  updateDesigner,
  deleteDesigner,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getDesignerAvailability,
  updateAvailability,
  adminGetAllDesigners,
  verifyDesigner,
  featureDesigner,
  updateDesignerStatus
};