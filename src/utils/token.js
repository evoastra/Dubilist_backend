// ===========================================
// JWT TOKEN UTILITY FUNCTIONS
// ===========================================

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { prisma } = require('../config/database');
const { hashToken } = require('./crypto');

// Generate access token
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || user.role?.name,
    type: 'access',
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
};

// Generate refresh token
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
};

// Generate both tokens
const generateTokenPair = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Parse refresh token expiry
  const expiresIn = parseExpiry(env.JWT_REFRESH_EXPIRY);
  const expiresAt = new Date(Date.now() + expiresIn);

  // Store refresh token hash in database
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiry(env.JWT_ACCESS_EXPIRY) / 1000, // in seconds
  };
};

// Revoke refresh token
const revokeRefreshToken = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
};

// Revoke all user's refresh tokens
const revokeAllUserTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

// Parse expiry string to milliseconds
const parseExpiry = (expiry) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }

  const [, value, unit] = match;
  return parseInt(value, 10) * units[unit];
};

// Generate password reset token
const generatePasswordResetToken = async (userId) => {
  const { generateToken } = require('./crypto');
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  
  // Invalidate existing tokens
  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  // Create new token
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return token;
};

// Verify password reset token
const verifyPasswordResetToken = async (token) => {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  return resetToken;
};

// Mark password reset token as used
const usePasswordResetToken = async (tokenId) => {
  await prisma.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  revokeRefreshToken,
  revokeAllUserTokens,
  verifyAccessToken,
  verifyRefreshToken,
  parseExpiry,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  usePasswordResetToken,
};