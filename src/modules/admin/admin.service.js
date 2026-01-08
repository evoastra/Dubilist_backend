// ===========================================
// ADMIN SERVICE - Business Logic (MERGED VERSION)
// Combines both admin implementations with all features
// ===========================================

const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');

class AdminService {
  // ==========================================
  // AUTH
  // ==========================================

  /**
   * Admin login
   */
  async login(email, password) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user || !user.passwordHash || user.role.name !== 'admin') {
      throw new Error('Invalid admin credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new Error('Invalid admin credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    logger.info({ userId: user.id, email }, 'Admin logged in');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name
    };
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalListings,
      pendingListings,
      activeListings,
      todayUsers,
      todayListings,
      totalReports,
      pendingReports
    ] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.listing.count({ where: { isDeleted: false } }),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.listing.count({ where: { status: 'approved', isDeleted: false } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.listing.count({ where: { createdAt: { gte: today } } }),
      prisma.reportedListing.count(),
      prisma.reportedListing.count({ where: { status: 'pending' } })
    ]);

    return {
      totalUsers,
      totalListings,
      pendingListings,
      activeListings,
      todayUsers,
      todayListings,
      totalReports,
      pendingReports
    };
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * Get all users with pagination and filters
   */
  async getUsers(filters = {}) {
    const { page = 1, limit = 20, role, isBlocked, search } = filters;
    const skip = (page - 1) * limit;

    const where = { isDeleted: false };

    if (role) {
      where.role = { name: role };
    }

    if (isBlocked !== undefined) {
      where.isBlocked = isBlocked === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role.name,
        isVerified: u.isVerified,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single user details
   */
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        listings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { category: true }
        },
        _count: {
          select: {
            listings: true,
            favorites: true,
            reportsAgainstMe: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Block or unblock user
   */
  async toggleBlockUser(userId, isBlocked) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked }
    });

    logger.info({ userId, isBlocked }, 'User block status updated');

    return {
      id: user.id,
      isBlocked: user.isBlocked
    };
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, roleName) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });

    if (!role) {
      throw new Error('Invalid role');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      include: { role: true }
    });

    logger.info({ userId, newRole: roleName }, 'User role updated');

    return {
      id: user.id,
      role: user.role.name
    };
  }

  /**
   * Restrict/unrestrict posting (NEW)
   */
  async togglePostingRestriction(userId, adminId, restrict) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { canPostListings: !restrict }
    });

    // Create audit log if auditLog table exists
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: adminId,
          action: restrict ? 'POSTING_RESTRICTED' : 'POSTING_UNRESTRICTED',
          entityType: 'user',
          entityId: userId,
          ipAddress: 'admin',
        },
      });
    } catch (e) {
      // Audit log table might not exist
      logger.warn('Audit log table not available');
    }

    logger.info({ userId, adminId, restrict }, 'User posting restriction toggled');

    return { message: `Posting ${restrict ? 'restricted' : 'unrestricted'}` };
  }

  /**
   * Impersonate user (NEW)
   */
  async impersonateUser(userId, adminId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'USER_IMPERSONATED',
          entityType: 'user',
          entityId: userId,
          ipAddress: 'admin',
        },
      });
    } catch (e) {
      logger.warn('Audit log table not available');
    }

    logger.warn({ adminId, userId }, 'Admin impersonating user');

    return { user };
  }

  /**
   * Get audit logs (NEW)
   */
  async getAuditLogs(filters = {}) {
    const { page = 1, limit = 50, action, userId } = filters;
    const skip = (page - 1) * limit;

    const where = {};
    if (action) where.action = action;
    if (userId) where.actorUserId = parseInt(userId, 10);

    try {
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      logger.warn('Audit log table not available');
      return {
        logs: [],
        pagination: { page, limit, total: 0, pages: 0 },
      };
    }
  }

  /**
   * Suspend listing (NEW)
   */
  async suspendListing(listingId, adminId, reason) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
      throw new Error('Listing not found');
    }

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'rejected', reasonRejected: reason },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'LISTING_SUSPENDED',
          entityType: 'listing',
          entityId: listingId,
          metadata: { reason },
          ipAddress: 'admin',
        },
      });
    } catch (e) {
      logger.warn('Audit log table not available');
    }

    logger.info({ listingId, adminId, reason }, 'Listing suspended');

    return { message: 'Listing suspended' };
  }

  // ==========================================
  // LISTING MANAGEMENT
  // ==========================================

  /**
   * Get all listings with filters
   */
  async getListings(filters = {}) {
    const { page = 1, limit = 20, status, search } = filters;
    const skip = (page - 1) * limit;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          images: { take: 1 }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.listing.count({ where })
    ]);

    return {
      listings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Approve or reject listing
   */
  async updateListingStatus(listingId, status, reasonRejected = null) {
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      throw new Error('Invalid status');
    }

    const listing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        status,
        reasonRejected: status === 'rejected' ? reasonRejected : null,
        publishedAt: status === 'approved' ? new Date() : undefined
      },
      include: { user: true }
    });

    // Create notification
    const notificationType = status === 'approved' ? 'listing_approved' : 'listing_rejected';
    await prisma.notification.create({
      data: {
        userId: listing.userId,
        type: notificationType,
        title: status === 'approved' ? 'Listing Approved' : 'Listing Rejected',
        message: status === 'approved'
          ? `Your listing "${listing.title}" has been approved and is now live.`
          : `Your listing "${listing.title}" has been rejected. Reason: ${reasonRejected || 'Not specified'}`,
        data: { listingId: listing.id }
      }
    }).catch(() => {});

    logger.info({ listingId, status }, 'Listing status updated');

    return listing;
  }

  // ==========================================
  // REPORTS MANAGEMENT
  // ==========================================

  /**
   * Get all reports
   */
  async getReports(filters = {}) {
    const { type = 'all', status = 'pending', page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    let listingReports = [];
    let userReports = [];

    if (type === 'all' || type === 'listing') {
      listingReports = await prisma.reportedListing.findMany({
        where: status !== 'all' ? { status } : {},
        include: {
          listing: { select: { id: true, title: true } },
          reporter: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'listing' ? skip : 0,
        take: type === 'listing' ? limit : 10
      });
    }

    if (type === 'all' || type === 'user') {
      userReports = await prisma.reportedUser.findMany({
        where: status !== 'all' ? { status } : {},
        include: {
          reportedUser: { select: { id: true, name: true, email: true } },
          reporter: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'user' ? skip : 0,
        take: type === 'user' ? limit : 10
      });
    }

    return { listingReports, userReports };
  }

  /**
   * Update report status
   */
  async updateReportStatus(type, reportId, status, reviewerId) {
    if (!['pending', 'reviewed', 'dismissed', 'actioned'].includes(status)) {
      throw new Error('Invalid status');
    }

    if (type === 'listing') {
      await prisma.reportedListing.update({
        where: { id: reportId },
        data: {
          status,
          reviewedBy: reviewerId,
          reviewedAt: new Date()
        }
      });
    } else if (type === 'user') {
      await prisma.reportedUser.update({
        where: { id: reportId },
        data: {
          status,
          reviewedBy: reviewerId,
          reviewedAt: new Date()
        }
      });
    } else {
      throw new Error('Invalid report type');
    }

    logger.info({ type, reportId, status }, 'Report status updated');
  }

  // ==========================================
  // SUPPORT TICKETS
  // ==========================================

  /**
   * Get all support tickets
   */
  async getSupportTickets(filters = {}) {
    const { status, priority, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.supportTicket.count({ where })
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Reply to support ticket
   */
  async replyToTicket(ticketId, adminId, message, newStatus = null) {
    if (!message) {
      throw new Error('Message is required');
    }

    const reply = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        senderType: 'admin',
        message
      }
    });

    // Update ticket status if provided
    if (newStatus) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: newStatus }
      });
    }

    logger.info({ ticketId, adminId }, 'Support ticket reply sent');

    return reply;
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [newUsers, newListings, totalViews, totalSearches] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.listing.count({ where: { createdAt: { gte: startDate } } }),
      prisma.listing.aggregate({ _sum: { viewsCount: true } }),
      prisma.searchLog.count({ where: { createdAt: { gte: startDate } } })
    ]);

    return {
      period: `${days} days`,
      newUsers,
      newListings,
      totalViews: totalViews._sum.viewsCount || 0,
      totalSearches
    };
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(limit = 20) {
    const searches = await prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
      where: { query: { not: '' } }
    });

    return searches.map(s => ({
      query: s.query,
      count: s._count.query
    }));
  }

  /**
   * Get category statistics
   */
  async getCategoryStats() {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        _count: {
          select: { listings: { where: { isDeleted: false } } }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    return categories.map(c => ({
      id: c.id,
      name: c.name,
      listingCount: c._count.listings
    }));
  }

  // ==========================================
  // FRAUD LOGS
  // ==========================================

  /**
   * Get fraud logs
   */
  async getFraudLogs(filters = {}) {
    const { page = 1, limit = 20, isReviewed } = filters;
    const skip = (page - 1) * limit;

    const where = {};

    if (isReviewed !== undefined) {
      where.isReviewed = isReviewed === 'true';
    }

    const [logs, total] = await Promise.all([
      prisma.fraudLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.fraudLog.count({ where })
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark fraud log as reviewed
   */
  async reviewFraudLog(logId) {
    await prisma.fraudLog.update({
      where: { id: logId },
      data: { isReviewed: true }
    });

    logger.info({ logId }, 'Fraud log reviewed');
  }

  // ==========================================
  // ROLES
  // ==========================================

  /**
   * Get all roles
   */
  async getRoles() {
    return prisma.role.findMany({
      include: {
        _count: { select: { users: true } }
      }
    });
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  /**
   * Create category
   */
  async createCategory(data) {
    const { name, slug, description, parentId, orderIndex = 0 } = data;

    if (!name || !slug) {
      throw new Error('Name and slug are required');
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        parentId: parentId ? parseInt(parentId) : null,
        orderIndex
      }
    });

    logger.info({ categoryId: category.id, slug }, 'Category created');

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, data) {
    const { name, slug, description, parentId, orderIndex, isActive } = data;

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId: parentId ? parseInt(parentId) : null }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(isActive !== undefined && { isActive })
      }
    });

    logger.info({ categoryId, slug }, 'Category updated');

    return category;
  }

  /**
   * Update category image
   */
  async updateCategoryImage(categoryId, imageUrl, s3Key) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!category) {
      throw new Error('Category not found');
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { imageUrl, s3Key }
    });

    logger.info({ categoryId }, 'Category image updated');

    return updated;
  }
  /**
 * Delete category
 */
async deleteCategory(categoryId) {
      const PROTECTED_IDS = [1, 2, 3, 4, 5, 6];
  if (PROTECTED_IDS.includes(categoryId)) {
    throw new Error('Cannot delete core categories (Motors, Jobs, Property, Classifieds, Electronics, Furniture)');
  }
  const category = await prisma.category.findUnique({ 
    where: { id: categoryId },
    include: {
      children: true,
      _count: { select: { listings: true } }
    }
  });

  if (!category) {
    throw new Error('Category not found');
  }

  // Check if category has listings
  if (category._count.listings > 0) {
    throw new Error('Cannot delete category with existing listings');
  }

  // Check if category has subcategories
  if (category.children.length > 0) {
    throw new Error('Cannot delete category with subcategories');
  }

  await prisma.category.delete({
    where: { id: categoryId }
  });

  logger.info({ categoryId }, 'Category deleted');

  return { message: 'Category deleted successfully' };
}

  // ==========================================
  // SYSTEM CONFIG
  // ==========================================

  /**
   * Get system config
   */
  async getSystemConfig() {
    const configs = await prisma.systemConfig.findMany();

    const configMap = {};
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    return configMap;
  }

  /**
   * Update system config
   */
  async updateSystemConfig(updates) {
    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }

    logger.info({ keys: Object.keys(updates) }, 'System config updated');
  }
}

module.exports = new AdminService();