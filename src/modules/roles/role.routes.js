// ===========================================
// ROLES SERVICE & ROUTES
// Feature: Role-Based Access Control Management
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');
const { validateBody, Joi } = require('../../middleware/validation');

class RoleService {
  // Get all roles
  async getRoles() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map(role => ({
      ...role,
      userCount: role._count.users,
      permissions: role.permissions.map(rp => rp.permission),
    }));
  }

  // Get role by ID
  async getRole(roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    return {
      ...role,
      permissions: role.permissions.map(rp => rp.permission),
    };
  }

  // Create role
  async createRole(data) {
    const { name, description, permissionIds = [] } = data;

    // Check name uniqueness
    const existing = await prisma.role.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ApiError(409, 'ROLE_EXISTS', 'Role with this name already exists');
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
      },
    });

    // Assign permissions
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    logger.info({ roleId: role.id, name }, 'Role created');

    return this.getRole(role.id);
  }

  // Update role
  async updateRole(roleId, data) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    // Prevent modifying system roles
    if (['admin', 'moderator', 'seller', 'buyer'].includes(role.name) && data.name) {
      throw new ApiError(400, 'SYSTEM_ROLE', 'Cannot rename system roles');
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    logger.info({ roleId, name: updated.name }, 'Role updated');

    return this.getRole(roleId);
  }

  // Delete role
  async deleteRole(roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    // Prevent deleting system roles
    if (['admin', 'moderator', 'seller', 'buyer'].includes(role.name)) {
      throw new ApiError(400, 'SYSTEM_ROLE', 'Cannot delete system roles');
    }

    if (role._count.users > 0) {
      throw new ApiError(400, 'ROLE_IN_USE', 'Cannot delete role with assigned users');
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    logger.info({ roleId, name: role.name }, 'Role deleted');

    return { message: 'Role deleted' };
  }

  // Assign permission to role
  async assignPermission(roleId, permissionId) {
    const [role, permission] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);

    if (!role) throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found');
    if (!permission) throw new ApiError(404, 'PERMISSION_NOT_FOUND', 'Permission not found');

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
      create: { roleId, permissionId },
      update: {},
    });

    return this.getRole(roleId);
  }

  // Remove permission from role
  async removePermission(roleId, permissionId) {
    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    return this.getRole(roleId);
  }

  // Get all permissions
  async getPermissions() {
    return prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  }
}

const roleService = new RoleService();

// Validation schemas
const createRoleSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(200),
  permissionIds: Joi.array().items(Joi.number().integer().positive()),
});

const updateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  description: Joi.string().max(200),
});

// All routes require admin
router.use(authenticate, requireAdmin);

// Roles CRUD
router.get('/', asyncHandler(async (req, res) => {
  const roles = await roleService.getRoles();
  successResponse(res, roles);
}));

router.get('/permissions', asyncHandler(async (req, res) => {
  const permissions = await roleService.getPermissions();
  successResponse(res, permissions);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const role = await roleService.getRole(parseInt(req.params.id, 10));
  successResponse(res, role);
}));

router.post('/', validateBody(createRoleSchema), asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body);
  createdResponse(res, role, 'Role created');
}));

router.put('/:id', validateBody(updateRoleSchema), asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(parseInt(req.params.id, 10), req.body);
  successResponse(res, role, 'Role updated');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await roleService.deleteRole(parseInt(req.params.id, 10));
  successResponse(res, null, 'Role deleted');
}));

// Permission management
router.post('/:id/permissions/:permissionId', asyncHandler(async (req, res) => {
  const role = await roleService.assignPermission(
    parseInt(req.params.id, 10),
    parseInt(req.params.permissionId, 10)
  );
  successResponse(res, role, 'Permission assigned');
}));

router.delete('/:id/permissions/:permissionId', asyncHandler(async (req, res) => {
  const role = await roleService.removePermission(
    parseInt(req.params.id, 10),
    parseInt(req.params.permissionId, 10)
  );
  successResponse(res, role, 'Permission removed');
}));

module.exports = router;