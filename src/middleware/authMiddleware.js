// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { env } = require('../config/env');
const { logger } = require('../config/logger');
const { ApiError } = require('./errorHandler');

// Verify access token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'ACCESS_TOKEN_REQUIRED', 'Access token is required');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(401, 'USER_NOT_FOUND', 'User not found');
      }

      if (user.isBlocked) {
        throw new ApiError(403, 'USER_BLOCKED', 'Your account has been blocked');
      }

      if (user.isDeleted) {
        throw new ApiError(401, 'USER_DELETED', 'User account has been deleted');
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        roleId: user.roleId,
        permissions: user.role.permissions.map(rp => rp.permission.key),
        isVerified: user.isVerified,
        canPostListings: user.canPostListings,
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'INVALID_TOKEN', 'Invalid access token');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          role: true,
        },
      });

      if (user && !user.isBlocked && !user.isDeleted) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          roleId: user.roleId,
          isVerified: user.isVerified,
          canPostListings: user.canPostListings,
        };
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Verify refresh token
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required');
    }

    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);

      // Check if token exists in database and is not revoked
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          userId: decoded.userId,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            include: { role: true },
          },
        },
      });

      if (!storedToken) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
      }

      if (storedToken.user.isBlocked || storedToken.user.isDeleted) {
        throw new ApiError(403, 'USER_BLOCKED', 'User account is blocked or deleted');
      }

      req.user = {
        id: storedToken.user.id,
        email: storedToken.user.email,
        name: storedToken.user.name,
        role: storedToken.user.role.name,
        roleId: storedToken.user.roleId,
      };
      req.refreshTokenRecord = storedToken;

      next();
    } catch (jwtError) {
      if (jwtError instanceof ApiError) throw jwtError;
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  verifyRefreshToken,
};