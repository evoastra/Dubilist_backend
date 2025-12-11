    // ===========================================
// INSIGHTS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');

// Get listing insights (for listing owner)
router.get(
  '/listings/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        userId: true,
        title: true,
        categoryId: true,
        viewsCount: true,
        favoritesCount: true,
        status: true,
        createdAt: true,
      },
    });

    if (!listing) {
      return successResponse(res, null, 'Listing not found');
    }

    if (listing.userId !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) {
      return successResponse(res, null, 'Access denied');
    }

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [viewsThisWeek, viewsThisMonth] = await Promise.all([
      prisma.listingView.count({
        where: { listingId, createdAt: { gte: weekAgo } },
      }),
      prisma.listingView.count({
        where: { listingId, createdAt: { gte: monthAgo } },
      }),
    ]);

    const categoryListings = await prisma.listing.findMany({
      where: { categoryId: listing.categoryId, status: 'approved', isDeleted: false },
      select: { id: true, viewsCount: true },
      orderBy: { viewsCount: 'desc' },
    });

    const ranking = categoryListings.findIndex(l => l.id === listingId) + 1;
    const totalInCategory = categoryListings.length;

    successResponse(res, {
      listing: { id: listing.id, title: listing.title, status: listing.status },
      stats: {
        totalViews: listing.viewsCount,
        totalFavorites: listing.favoritesCount,
        viewsThisWeek,
        viewsThisMonth,
      },
      ranking: {
        position: ranking,
        total: totalInCategory,
        percentile: totalInCategory > 0 ? Math.round((1 - ranking / totalInCategory) * 100) : 0,
      },
    });
  })
);

// Get user insights (seller dashboard)
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [totalListings, activeListings, totalViews, totalFavorites, totalChats] = await Promise.all([
      prisma.listing.count({ where: { userId, isDeleted: false } }),
      prisma.listing.count({ where: { userId, status: 'approved', isDeleted: false } }),
      prisma.listing.aggregate({
        where: { userId, isDeleted: false },
        _sum: { viewsCount: true },
      }),
      prisma.listing.aggregate({
        where: { userId, isDeleted: false },
        _sum: { favoritesCount: true },
      }),
      prisma.chatRoom.count({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      }),
    ]);

    const topListings = await prisma.listing.findMany({
      where: { userId, isDeleted: false, status: 'approved' },
      select: { id: true, title: true, viewsCount: true, favoritesCount: true, images: { take: 1 } },
      orderBy: { viewsCount: 'desc' },
      take: 5,
    });

    successResponse(res, {
      overview: {
        totalListings,
        activeListings,
        totalViews: totalViews._sum.viewsCount || 0,
        totalFavorites: totalFavorites._sum.favoritesCount || 0,
        totalChats,
      },
      topListings,
    });
  })
);

module.exports = router;