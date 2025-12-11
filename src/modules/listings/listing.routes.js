// ===========================================
// LISTING ROUTES - SIMPLIFIED
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');
const { authenticate } = require('../../middleware/authMiddleware');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse } = require('../../utils/response');

// Validation schemas
const createListingSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(20).max(5000).required(),
  price: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('AED'),
  categoryId: Joi.number().integer().positive().required(),
  city: Joi.string().max(100),
  country: Joi.string().max(100),
  contactPhone: Joi.string().max(20),
  contactEmail: Joi.string().email(),
  condition: Joi.string().valid('new', 'used', 'refurbished'),
});

const updateListingSchema = Joi.object({
  title: Joi.string().min(5).max(200),
  description: Joi.string().min(20).max(5000),
  price: Joi.number().positive(),
  city: Joi.string().max(100),
  country: Joi.string().max(100),
  condition: Joi.string().valid('new', 'used', 'refurbished'),
});

const listingsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'pending', 'approved', 'rejected', 'sold', 'expired'),
  categoryId: Joi.number().integer().positive(),
  city: Joi.string(),
  minPrice: Joi.number().positive(),
  maxPrice: Joi.number().positive(),
  q: Joi.string().max(200),
});

// GET all listings (public)
router.get('/', validateQuery(listingsQuerySchema), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'approved', categoryId, city, minPrice, maxPrice, q } = req.query;
  const skip = (page - 1) * limit;

  const where = { isDeleted: false };
  if (status) where.status = status;
  if (categoryId) where.categoryId = parseInt(categoryId, 10);
  if (city) where.city = city;

  const listings = await prisma.listing.findMany({
    where,
    skip,
    take: parseInt(limit, 10),
  });

  const total = await prisma.listing.count({ where });

  res.json({
    success: true,
    data: listings,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// GET single listing (public)
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const listing = await prisma.listing.findUnique({
    where: { id: parseInt(id, 10) }
  });

  if (!listing || listing.isDeleted) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Listing not found' }
    });
  }

  successResponse(res, listing);
}));

// CREATE listing (protected)
router.post('/', authenticate, validateBody(createListingSchema), asyncHandler(async (req, res) => {
  const listing = await prisma.listing.create({
    data: {
      ...req.body,
      userId: req.user.id,
      status: 'draft'
    }
  });

  createdResponse(res, listing, 'Listing created successfully');
}));

// UPDATE listing (protected)
router.put('/:id', authenticate, validateBody(updateListingSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await prisma.listing.findUnique({
    where: { id: parseInt(id, 10) }
  });

  if (!listing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Listing not found' }
    });
  }

  if (listing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not authorized' }
    });
  }

  const updated = await prisma.listing.update({
    where: { id: parseInt(id, 10) },
    data: req.body
  });

  successResponse(res, updated, 'Listing updated successfully');
}));

// DELETE listing (protected)
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await prisma.listing.findUnique({
    where: { id: parseInt(id, 10) }
  });

  if (!listing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Listing not found' }
    });
  }

  if (listing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not authorized' }
    });
  }

  await prisma.listing.update({
    where: { id: parseInt(id, 10) },
    data: { isDeleted: true, deletedAt: new Date() }
  });

  successResponse(res, null, 'Listing deleted successfully');
}));

// PUBLISH listing (protected)
router.put('/:id/publish', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await prisma.listing.update({
    where: { id: parseInt(id, 10) },
    data: { status: 'pending' }
  });

  successResponse(res, listing, 'Listing submitted for review');
}));

// MARK AS SOLD (protected)
router.put('/:id/sold', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const listing = await prisma.listing.update({
    where: { id: parseInt(id, 10) },
    data: { status: 'sold' }
  });

  successResponse(res, listing, 'Listing marked as sold');
}));

module.exports = router;