// ===========================================
// AUTH SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { emailTemplates } = require('../../config/mailer');
const { hashPassword, comparePassword } = require('../../utils/crypto');
const {
  generateTokenPair,
  revokeRefreshToken,
  revokeAllUserTokens,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  usePasswordResetToken,
} = require('../../utils/token');
const { ApiError } = require('../../middleware/errorHandler');
const { fraudService } = require('../fraud/fraud.service');

class AuthService {
  // Register new user
  async register(data) {
    const { email, password, name, phone, role = 'buyer' } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      });

      if (existingPhone) {
        throw new ApiError(409, 'PHONE_EXISTS', 'An account with this phone number already exists');
      }
    }

    // Get role ID
    const roleRecord = await prisma.role.findFirst({
      where: { name: role },
    });

    if (!roleRecord) {
      throw new ApiError(400, 'INVALID_ROLE', 'Invalid role specified');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone,
        roleId: roleRecord.id,
      },
      include: {
        role: true,
      },
    });

    // Generate tokens
    const tokens = await generateTokenPair(user);

    // Send welcome email
    emailTemplates.sendWelcome(user).catch(err => {
      logger.error({ err, userId: user.id }, 'Failed to send welcome email');
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Login user
  async login(email, password, deviceInfo) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });

    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.isBlocked) {
      throw new ApiError(403, 'USER_BLOCKED', 'Your account has been blocked');
    }

    if (user.isDeleted) {
      throw new ApiError(401, 'USER_DELETED', 'This account has been deleted');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const tokens = await generateTokenPair(user);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: user.id,
        ipAddress: deviceInfo?.ipAddress || 'unknown',
        deviceInfo: deviceInfo || {},
      },
    });

    // Check for fraud (many devices)
    fraudService.checkManyDevices(user.id).catch(err => {
      logger.error({ err, userId: user.id }, 'Fraud check failed');
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Refresh access token
  async refreshToken(user, oldRefreshToken) {
    // Revoke old refresh token
    await revokeRefreshToken(oldRefreshToken);

    // Generate new tokens
    const tokens = await generateTokenPair(user);

    logger.info({ userId: user.id }, 'Token refreshed');

    return tokens;
  }

  // Logout
  async logout(refreshToken) {
    await revokeRefreshToken(refreshToken);
    logger.info('User logged out');
  }

  // Logout all sessions
  async logoutAll(userId) {
    await revokeAllUserTokens(userId);
    logger.info({ userId }, 'All sessions logged out');
  }

  // Forgot password
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    if (user.isBlocked || user.isDeleted) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = await generatePasswordResetToken(user.id);

    // Send email
    await emailTemplates.sendPasswordReset(user, resetToken);

    logger.info({ userId: user.id }, 'Password reset token generated');

    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Reset password
  async resetPassword(token, newPassword) {
    const resetToken = await verifyPasswordResetToken(token);

    if (!resetToken) {
      throw new ApiError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await usePasswordResetToken(resetToken.id);

    // Revoke all refresh tokens
    await revokeAllUserTokens(resetToken.userId);

    logger.info({ userId: resetToken.userId }, 'Password reset successful');

    return { message: 'Password has been reset successfully' };
  }

  // Change password (authenticated)
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      throw new ApiError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens except current
    await revokeAllUserTokens(userId);

    logger.info({ userId }, 'Password changed');

    return { message: 'Password changed successfully' };
  }

  // Sanitize user object for response
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
      createdAt: sanitized.createdAt,
    };
  }
}

module.exports = { authService: new AuthService() };