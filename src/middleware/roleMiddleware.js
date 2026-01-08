// ===========================================
// ROLE-BASED ACCESS CONTROL MIDDLEWARE
// ===========================================

const { ApiError } = require('./errorHandler');
const { logger } = require('../config/logger');


// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY = {
  buyer: 0,
  seller: 1,
  moderator: 2,
  admin: 3,
};

// Check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const userRole = req.user.role.toLowerCase();

      if (!allowedRoles.includes(userRole)) {
        logger.warn({
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
        }, 'Access denied - insufficient role');

        throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user has minimum role level
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const userRole = req.user.role.toLowerCase();
      const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
      const requiredLevel = ROLE_HIERARCHY[minRole.toLowerCase()] ?? 999;

      if (userLevel < requiredLevel) {
        logger.warn({
          userId: req.user.id,
          userRole,
          minRole,
          path: req.path,
        }, 'Access denied - insufficient role level');

        throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
const requireAdminOrModerator = requireRole('admin', 'moderator');

// Check if user has specific permission
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Admin has all permissions
      if (req.user.role.toLowerCase() === 'admin') {
        return next();
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        logger.warn({
          userId: req.user.id,
          userPermissions,
          requiredPermissions,
          path: req.path,
        }, 'Access denied - missing permission');

        throw new ApiError(403, 'FORBIDDEN', 'You do not have the required permission');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user is admin or moderator
const requireModerator = requireRole('admin', 'moderator');

// Check if user is admin only
const requireAdmin = requireRole('admin');


// Check if user can post listings
const requireCanPost = (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!req.user.canPostListings) {
      throw new ApiError(403, 'POSTING_RESTRICTED', 'Your posting privileges have been restricted');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check if user owns a resource
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Admin can access any resource
      if (req.user.role.toLowerCase() === 'admin') {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);

      if (ownerId !== req.user.id) {
        throw new ApiError(403, 'FORBIDDEN', 'You do not own this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Allow owner OR admin/moderator
const requireOwnerOrModerator = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const userRole = req.user.role.toLowerCase();

      // Admin or moderator can access any resource
      if (userRole === 'admin' || userRole === 'moderator') {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);

      if (ownerId !== req.user.id) {
        throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  requireRole,
  requireMinRole,
  requirePermission,
  requireModerator,
  requireAdmin,
  requireCanPost,
  requireOwnership,
  requireAdmin,  
  requireAdminOrModerator, 
  requireOwnerOrModerator,
  ROLE_HIERARCHY,
};