// ===========================================
// OTP SERVICE (Updated with Email Support)
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { generateOTP, hashOTP } = require('../../utils/crypto');
const { generateTokenPair } = require('../../utils/token');
const { ApiError } = require('../../middleware/errorHandler');
const { sendOTPEmail } = require('../../utils/emailService');

class OTPService {
  // Send OTP to email for password reset
  async sendPasswordResetOTP(email) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Security: Don't reveal if email exists
      return {
        message: 'If the email exists, an OTP has been sent',
        expiresIn: env.OTP_EXPIRY_MINUTES * 60,
      };
    }

    // Check rate limiting
    const recentRequest = await prisma.otpRequest.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gt: new Date(Date.now() - env.OTP_COOLDOWN_MINUTES * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      const waitTime = Math.ceil(
        (recentRequest.createdAt.getTime() + env.OTP_COOLDOWN_MINUTES * 60 * 1000 - Date.now()) / 1000
      );
      throw new ApiError(
        429,
        'OTP_COOLDOWN',
        `Please wait ${waitTime} seconds before requesting another OTP`
      );
    }

    // Generate OTP
    const otp = generateOTP(env.OTP_LENGTH);
    const otpHash = hashOTP(otp);

    // Store OTP request
    await prisma.otpRequest.create({
      data: {
        userId: user.id,
        email: user.email,
        otpHash,
        expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    // Send OTP via email
    try {
      await sendOTPEmail(user.email, otp, env.OTP_EXPIRY_MINUTES);
      logger.info({ email: user.email }, 'Password reset OTP sent');
    } catch (error) {
      logger.error({ error, email: user.email }, 'Failed to send OTP email');
      throw new ApiError(500, 'EMAIL_SEND_FAILED', 'Failed to send OTP email');
    }

    return {
      message: 'OTP sent to your email',
      expiresIn: env.OTP_EXPIRY_MINUTES * 60,
    };
  }

  // Verify OTP for password reset
  async verifyPasswordResetOTP(email, otp) {
    const otpHash = hashOTP(otp);

    // Find valid OTP request
    const otpRequest = await prisma.otpRequest.findFirst({
      where: {
        email,
        otpHash,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: env.OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    if (!otpRequest) {
      // Increment attempts on recent requests
      await prisma.otpRequest.updateMany({
        where: {
          email,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      throw new ApiError(400, 'INVALID_OTP', 'Invalid or expired OTP');
    }

    // Mark OTP as verified
    await prisma.otpRequest.update({
      where: { id: otpRequest.id },
      data: { verifiedAt: new Date() },
    });

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token
    await prisma.user.update({
      where: { id: otpRequest.userId },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    logger.info({ userId: otpRequest.userId, email }, 'OTP verified for password reset');

    return {
      message: 'OTP verified successfully',
      resetToken, // Send this to frontend
      userId: otpRequest.userId,
    };
  }

  // Send OTP to phone number (existing method)
  async sendOTP(phone) {
    // ... existing phone OTP code ...
  }

  // Verify OTP (existing method)
  async verifyOTP(phone, otp) {
    // ... existing phone OTP verification code ...
  }

  // Resend OTP
  async resendOTP(phone) {
    // ... existing resend code ...
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
      createdAt: sanitized.createdAt,
    };
  }
}

module.exports = { otpService: new OTPService() };