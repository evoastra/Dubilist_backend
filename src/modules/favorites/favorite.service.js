// ===========================================
// FAVORITES SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { ApiError } = require('../../middleware/errorHandler');
const { logger } = require('../../config/logger');

class FavoriteService {
  // Add to favorites
  async addFavorite(userId, listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted || listing.status !== 'approved') {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    if (existing) {
      throw new ApiError(409, 'ALREADY_FAVORITED', 'Listing is already in favorites');
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: { userId, listingId },
    });

    // Increment favorites count on listing
    await prisma.listing.update({
      where: { id: listingId },
      data: { favoritesCount: { increment: 1 } },
    });

    logger.info({ userId, listingId }, 'Added to favorites');

    return favorite;
  }

  // Remove from favorites
  async removeFavorite(userId, listingId) {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    if (!favorite) {
      throw new ApiError(404, 'NOT_FAVORITED', 'Listing is not in favorites');
    }

    await prisma.favorite.delete({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    // Decrement favorites count on listing
    await prisma.listing.update({
      where: { id: listingId },
      data: { favoritesCount: { decrement: 1 } },
    });

    logger.info({ userId, listingId }, 'Removed from favorites');

    return { message: 'Removed from favorites' };
  }

  // Get user's favorites
  async getFavorites(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        include: {
          listing: {
            include: {
              category: true,
              images: {
                orderBy: { orderIndex: 'asc' },
                take: 1,
              },
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    // Filter out deleted/non-approved listings
    const validFavorites = favorites.filter(
      f => f.listing && !f.listing.isDeleted && f.listing.status === 'approved'
    );

    return {
      data: validFavorites.map(f => ({
        id: f.id,
        addedAt: f.createdAt,
        listing: f.listing,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Check if listing is favorited
  async isFavorited(userId, listingId) {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    return !!favorite;
  }
}

module.exports = { favoriteService: new FavoriteService() };