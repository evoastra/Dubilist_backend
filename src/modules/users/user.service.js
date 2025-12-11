// ===========================================
// USER SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError } = require('../../middleware/errorHandler');

class UserService {
  // Get user by ID
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        _count: {
          select: {
            listings: { where: { isDeleted: false } },
            favorites: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return this.sanitizeUser(user);
  }

  // Get user profile (public)
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            listings: { where: { isDeleted: false, status: 'approved' } },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return user;
  }

  // Update user profile
  async updateProfile(userId, data) {
    const { name, phone, bio, avatarUrl } = data;

    // Check phone uniqueness if provided
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: userId },
        },
      });

      if (existingPhone) {
        throw new ApiError(409, 'PHONE_EXISTS', 'Phone number is already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        bio,
        avatarUrl,
      },
      include: { role: true },
    });

    logger.info({ userId }, 'User profile updated');

    return this.sanitizeUser(user);
  }

  // Get user sessions
  async getUserSessions(userId) {
    const sessions = await prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
    });

    return sessions;
  }

  // Delete session
  async deleteSession(userId, sessionId) {
    const session = await prisma.deviceSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }

    await prisma.deviceSession.delete({
      where: { id: sessionId },
    });

    logger.info({ userId, sessionId }, 'Session deleted');
  }

  // Deactivate account
  async deactivateAccount(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Revoke all tokens
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    logger.info({ userId }, 'Account deactivated');

    return { message: 'Account deactivated successfully' };
  }

  // Get user's listings
  async getUserListings(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          category: true,
          images: {
            orderBy: { orderIndex: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    return {
      data: listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Export user data (GDPR compliance)
  async exportUserData(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        listings: {
          include: {
            images: true,
            category: true,
          },
        },
        favorites: {
          include: {
            listing: true,
          },
        },
        chatRoomsAsBuyer: {
          include: {
            messages: true,
          },
        },
        chatRoomsAsSeller: {
          include: {
            messages: true,
          },
        },
        supportTickets: {
          include: {
            messages: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Remove sensitive fields
    const { passwordHash, ...exportData } = user;

    logger.info({ userId }, 'User data exported');

    return exportData;
  }

  // Sanitize user object
  sanitizeUser(user) {
    const { passwordHash, ...sanitized } = user;
    return {
      id: sanitized.id,
      email: sanitized.email,
      name: sanitized.name,
      phone: sanitized.phone,
      role: sanitized.role?.name || sanitized.role,
      isVerified: sanitized.isVerified,
      avatarUrl: sanitized.avatarUrl,
      bio: sanitized.bio,
      createdAt: sanitized.createdAt,
      listingsCount: sanitized._count?.listings,
      favoritesCount: sanitized._count?.favorites,
    };
  }
}

module.exports = { userService: new UserService() };