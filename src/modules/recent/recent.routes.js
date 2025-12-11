// ===========================================
// RECENTLY VIEWED SERVICE & ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');

class RecentlyViewedService {
  // Get recently viewed listings
  async getRecentlyViewed(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.recentlyViewed.findMany({
        where: { userId },
        include: {
          listing: {
            include: {
              category: true,
              images: {
                orderBy: { orderIndex: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { viewedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.recentlyViewed.count({ where: { userId } }),
    ]);

    // Filter out deleted/non-approved listings
    const validItems = items.filter(
      item => item.listing && !item.listing.isDeleted && item.listing.status === 'approved'
    );

    return {
      data: validItems.map(item => ({
        viewedAt: item.viewedAt,
        listing: item.listing,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Clear recently viewed
  async clearRecentlyViewed(userId) {
    await prisma.recentlyViewed.deleteMany({
      where: { userId },
    });

    return { message: 'Recently viewed cleared' };
  }

  // Remove specific item from recently viewed
  async removeFromRecentlyViewed(userId, listingId) {
    await prisma.recentlyViewed.delete({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    return { message: 'Removed from recently viewed' };
  }
}

const recentlyViewedService = new RecentlyViewedService();

// Routes
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await recentlyViewedService.getRecentlyViewed(req.user.id, req.query);
    paginatedResponse(res, result);
  })
);

router.delete(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await recentlyViewedService.clearRecentlyViewed(req.user.id);
    successResponse(res, null, 'Recently viewed cleared');
  })
);

router.delete(
  '/:listingId',
  authenticate,
  asyncHandler(async (req, res) => {
    await recentlyViewedService.removeFromRecentlyViewed(
      req.user.id,
      parseInt(req.params.listingId, 10)
    );
    successResponse(res, null, 'Removed from recently viewed');
  })
);

module.exports = router;