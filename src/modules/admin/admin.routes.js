// ===========================================
// ADMIN SERVICE & ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireAdmin, requireModerator } = require('../../middleware/roleMiddleware');
const { generateTokenPair } = require('../../utils/token');
const { setMaintenanceMode } = require('../../middleware/maintenanceMode');
const { validateBody, validateQuery, Joi } = require('../../middleware/validation');
const { comparePassword } = require('../../utils/crypto');
const { getDeviceInfo } = require('../../middleware/deviceTracking');

class AdminService {
  // Admin login
  async adminLogin(email, password, deviceInfo) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user || !['admin', 'moderator'].includes(user.role.name)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid admin credentials');
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid admin credentials');
    }

    const tokens = await generateTokenPair(user);

    // Log admin login
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'ADMIN_LOGIN',
        entityType: 'user',
        entityId: user.id,
        ipAddress: deviceInfo?.ipAddress || 'unknown',
        deviceInfo: deviceInfo || {},
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, email: user.email }, 'Admin logged in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      tokens,
    };
  }

  // Get all users
  async getUsers(options = {}) {
    const { page = 1, limit = 20, role, isBlocked, search } = options;
    const skip = (page - 1) * limit;

    const where = { isDeleted: false };
    if (role) {
      const roleRecord = await prisma.role.findFirst({ where: { name: role } });
      if (roleRecord) where.roleId = roleRecord.id;
    }
    if (isBlocked !== undefined) where.isBlocked = isBlocked === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          _count: { select: { listings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map(u => ({
        ...u,
        passwordHash: undefined,
        listingsCount: u._count.listings,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Block/unblock user
  async toggleBlockUser(userId, adminId, block) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

    await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: block },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: block ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
        entityType: 'user',
        entityId: userId,
        ipAddress: 'admin',
      },
    });

    logger.info({ userId, adminId, action: block ? 'blocked' : 'unblocked' }, 'User block status changed');
    return { message: `User ${block ? 'blocked' : 'unblocked'}` };
  }

  // Restrict/unrestrict posting
  async togglePostingRestriction(userId, adminId, restrict) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

    await prisma.user.update({
      where: { id: userId },
      data: { canPostListings: !restrict },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: restrict ? 'POSTING_RESTRICTED' : 'POSTING_UNRESTRICTED',
        entityType: 'user',
        entityId: userId,
        ipAddress: 'admin',
      },
    });

    return { message: `Posting ${restrict ? 'restricted' : 'unrestricted'}` };
  }

  // Change user role
  async changeUserRole(userId, adminId, roleName) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new ApiError(400, 'INVALID_ROLE', 'Invalid role');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

    await prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'user',
        entityId: userId,
        metadata: { newRole: roleName },
        ipAddress: 'admin',
      },
    });

    return { message: `User role changed to ${roleName}` };
  }

  // Impersonate user
  async impersonateUser(userId, adminId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

    // Generate token for impersonation (short-lived)
    const tokens = await generateTokenPair(user);

    await prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'USER_IMPERSONATED',
        entityType: 'user',
        entityId: userId,
        ipAddress: 'admin',
      },
    });

    logger.warn({ adminId, userId }, 'Admin impersonating user');

    return { user, tokens };
  }

  // Get audit logs
  async getAuditLogs(options = {}) {
    const { page = 1, limit = 50, action, userId } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (action) where.action = action;
    if (userId) where.actorUserId = parseInt(userId, 10);

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
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Suspend listing
  async suspendListing(listingId, adminId, reason) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'rejected', reasonRejected: reason },
    });

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

    return { message: 'Listing suspended' };
  }

  // Get all roles
  async getRoles() {
    return prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }
}

const adminService = new AdminService();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const usersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid('admin', 'moderator', 'seller', 'buyer'),
  isBlocked: Joi.string().valid('true', 'false'),
  search: Joi.string().max(100),
});

const roleChangeSchema = Joi.object({
  role: Joi.string().valid('admin', 'moderator', 'seller', 'buyer').required(),
});

const suspendSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

const maintenanceSchema = Joi.object({
  enabled: Joi.boolean().required(),
});

// Public admin login
router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const deviceInfo = getDeviceInfo(req);
  const result = await adminService.adminLogin(req.body.email, req.body.password, deviceInfo);
  successResponse(res, result, 'Admin login successful');
}));

// Protected admin routes
router.use(authenticate, requireAdmin);

// Users management
router.get('/users', validateQuery(usersQuerySchema), asyncHandler(async (req, res) => {
  const result = await adminService.getUsers(req.query);
  paginatedResponse(res, result);
}));

router.put('/users/:id/block', asyncHandler(async (req, res) => {
  await adminService.toggleBlockUser(parseInt(req.params.id, 10), req.user.id, true);
  successResponse(res, null, 'User blocked');
}));

router.put('/users/:id/unblock', asyncHandler(async (req, res) => {
  await adminService.toggleBlockUser(parseInt(req.params.id, 10), req.user.id, false);
  successResponse(res, null, 'User unblocked');
}));

router.put('/users/:id/restrict-posting', asyncHandler(async (req, res) => {
  await adminService.togglePostingRestriction(parseInt(req.params.id, 10), req.user.id, true);
  successResponse(res, null, 'Posting restricted');
}));

router.put('/users/:id/unrestrict-posting', asyncHandler(async (req, res) => {
  await adminService.togglePostingRestriction(parseInt(req.params.id, 10), req.user.id, false);
  successResponse(res, null, 'Posting unrestricted');
}));

router.put('/users/:id/role', validateBody(roleChangeSchema), asyncHandler(async (req, res) => {
  await adminService.changeUserRole(parseInt(req.params.id, 10), req.user.id, req.body.role);
  successResponse(res, null, 'Role changed');
}));

router.post('/users/:id/impersonate', asyncHandler(async (req, res) => {
  const result = await adminService.impersonateUser(parseInt(req.params.id, 10), req.user.id);
  successResponse(res, result, 'Impersonation tokens generated');
}));

// Listings management
router.post('/listings/:id/suspend', validateBody(suspendSchema), asyncHandler(async (req, res) => {
  await adminService.suspendListing(parseInt(req.params.id, 10), req.user.id, req.body.reason);
  successResponse(res, null, 'Listing suspended');
}));

// Audit logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const result = await adminService.getAuditLogs(req.query);
  paginatedResponse(res, result);
}));

// Roles
router.get('/roles', asyncHandler(async (req, res) => {
  const roles = await adminService.getRoles();
  successResponse(res, roles);
}));

// Maintenance mode
router.put('/maintenance', validateBody(maintenanceSchema), asyncHandler(async (req, res) => {
  await setMaintenanceMode(req.body.enabled);
  await prisma.auditLog.create({
    data: {
      actorUserId: req.user.id,
      action: req.body.enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
      ipAddress: 'admin',
    },
  });
  successResponse(res, null, `Maintenance mode ${req.body.enabled ? 'enabled' : 'disabled'}`);
}));

module.exports = router;