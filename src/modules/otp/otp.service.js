// ===========================================
// OTP SERVICE - Full Implementation
// File: src/modules/otp/otp.service.js
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { generateOTP, hashOTP } = require('../../utils/crypto');
const { ApiError } = require('../../middleware/errorHandler');
const {
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
  sendPhoneOTPEmail,
} = require('../../utils/emailService');

class OTPService {

  // ==========================================
  // PASSWORD RESET - SEND OTP (Email)
  // ==========================================
  async sendPasswordResetOTP(email) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Security: don't reveal if email exists
    if (!user) {
      return {
        message: 'If the email exists, an OTP has been sent',
        expiresIn: env.OTP_EXPIRY_MINUTES * 60,
      };
    }

    // Rate limit check
    const recentRequest = await prisma.otpRequest.findFirst({
      where: {
        userId: user.id,
        email: user.email,
        createdAt: {
          gt: new Date(Date.now() - env.OTP_COOLDOWN_MINUTES * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      const waitTime = Math.ceil(
        (recentRequest.createdAt.getTime() +
          env.OTP_COOLDOWN_MINUTES * 60 * 1000 -
          Date.now()) / 1000
      );
      throw new ApiError(429, 'OTP_COOLDOWN', `Please wait ${waitTime} seconds before requesting another OTP`);
    }

    const otp = generateOTP(env.OTP_LENGTH || 6);
    const otpHash = hashOTP(otp);

    await prisma.otpRequest.create({
      data: {
        userId: user.id,
        email: user.email,
        otpHash,
        expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

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

  // ==========================================
  // PASSWORD RESET - VERIFY OTP (Email)
  // ==========================================
  async verifyPasswordResetOTP(email, otp) {
    const otpHash = hashOTP(otp);

    const otpRequest = await prisma.otpRequest.findFirst({
      where: {
        email,
        otpHash,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: env.OTP_MAX_ATTEMPTS || 3 },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    if (!otpRequest) {
      // Increment attempts on recent unverified requests
      await prisma.otpRequest.updateMany({
        where: {
          email,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { attempts: { increment: 1 } },
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

    await prisma.user.update({
      where: { id: otpRequest.userId },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });

    logger.info({ userId: otpRequest.userId, email }, 'OTP verified for password reset');

    return {
      message: 'OTP verified successfully',
      resetToken, // raw token sent to frontend
      userId: otpRequest.userId,
    };
  }

  // ==========================================
  // PHONE OTP - SEND
  // Since no SMS provider, OTP is sent to the
  // user's registered email as a fallback.
  // Replace sendPhoneOTPEmail with SMS later.
  // ==========================================
  async sendOTP(phone) {
    // Find user by phone
    const user = await prisma.user.findFirst({
      where: { phone },
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'No account found with this phone number');
    }

    if (!user.email) {
      throw new ApiError(400, 'NO_EMAIL', 'Account has no email address to deliver OTP');
    }

    // Rate limit check
    const recentRequest = await prisma.otpRequest.findFirst({
      where: {
        userId: user.id,
        phone,
        createdAt: {
          gt: new Date(Date.now() - (env.OTP_COOLDOWN_MINUTES || 1) * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      const waitTime = Math.ceil(
        (recentRequest.createdAt.getTime() +
          (env.OTP_COOLDOWN_MINUTES || 1) * 60 * 1000 -
          Date.now()) / 1000
      );
      throw new ApiError(429, 'OTP_COOLDOWN', `Please wait ${waitTime} seconds before requesting another OTP`);
    }

    const otp = generateOTP(env.OTP_LENGTH || 6);
    const otpHash = hashOTP(otp);

    await prisma.otpRequest.create({
      data: {
        userId: user.id,
        phone,
        email: user.email, // store email for delivery
        otpHash,
        expiresAt: new Date(Date.now() + (env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000),
      },
    });

    try {
      // TODO: Replace with SMS provider (Twilio/AWS SNS) when available
      // For now, send OTP to user's registered email
      await sendPhoneOTPEmail(user.email, otp, phone, env.OTP_EXPIRY_MINUTES || 10);
      logger.info({ phone, userId: user.id }, 'Phone OTP sent via email (no SMS provider)');
    } catch (error) {
      logger.error({ error, phone }, 'Failed to send phone OTP');
      throw new ApiError(500, 'OTP_SEND_FAILED', 'Failed to send OTP');
    }

    return {
      message: 'OTP sent to your registered email address',
      expiresIn: (env.OTP_EXPIRY_MINUTES || 10) * 60,
      // In dev mode, log OTP for testing
      ...(process.env.NODE_ENV === 'development' && { _dev_otp: otp }),
    };
  }

  // ==========================================
  // PHONE OTP - VERIFY
  // ==========================================
  async verifyOTP(phone, otp) {
    const otpHash = hashOTP(otp);

    const otpRequest = await prisma.otpRequest.findFirst({
      where: {
        phone,
        otpHash,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: env.OTP_MAX_ATTEMPTS || 3 },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    if (!otpRequest) {
      // Increment attempts
      await prisma.otpRequest.updateMany({
        where: {
          phone,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { attempts: { increment: 1 } },
      });
      throw new ApiError(400, 'INVALID_OTP', 'Invalid or expired OTP');
    }

    // Mark as verified
    await prisma.otpRequest.update({
      where: { id: otpRequest.id },
      data: { verifiedAt: new Date() },
    });

    // Mark phone as verified on user
    await prisma.user.update({
      where: { id: otpRequest.userId },
      data: { isVerified: true },
    });

    logger.info({ phone, userId: otpRequest.userId }, 'Phone OTP verified');

    return {
      message: 'Phone number verified successfully',
      userId: otpRequest.userId,
    };
  }

  // ==========================================
  // PHONE OTP - RESEND
  // ==========================================
  async resendOTP(phone) {
    // Invalidate existing unexpired OTPs for this phone
    await prisma.otpRequest.updateMany({
      where: {
        phone,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(), // expire them now
      },
    });

    // Send fresh OTP (reuses sendOTP logic)
    return this.sendOTP(phone);
  }

  // ==========================================
  // SANITIZE USER
  // ==========================================
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