// ===========================================
// OTP SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { generateOTP, hashOTP } = require('../../utils/crypto');
const { generateTokenPair } = require('../../utils/token');
const { ApiError } = require('../../middleware/errorHandler');

class OTPService {
  // Send OTP to phone number
  async sendOTP(phone) {
    // Check rate limiting - find recent OTP requests
    const recentRequest = await prisma.otpRequest.findFirst({
      where: {
        phone,
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

    // Find user by phone (if exists)
    const user = await prisma.user.findFirst({
      where: { phone },
    });

    // Store OTP request
    await prisma.otpRequest.create({
      data: {
        userId: user?.id || null,
        phone,
        otpHash,
        expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    // Send OTP via SMS provider
    await this.sendSMS(phone, otp);

    logger.info({ phone }, 'OTP sent');

    return {
      message: 'OTP sent successfully',
      expiresIn: env.OTP_EXPIRY_MINUTES * 60, // seconds
    };
  }

  // Verify OTP
  async verifyOTP(phone, otp) {
    const otpHash = hashOTP(otp);

    // Find valid OTP request
    const otpRequest = await prisma.otpRequest.findFirst({
      where: {
        phone,
        otpHash,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: env.OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRequest) {
      // Increment attempts on recent requests
      await prisma.otpRequest.updateMany({
        where: {
          phone,
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

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { phone },
      include: { role: true },
    });

    if (!user) {
      // Create new user with phone
      const buyerRole = await prisma.role.findFirst({
        where: { name: 'buyer' },
      });

      user = await prisma.user.create({
        data: {
          phone,
          name: `User_${phone.slice(-4)}`,
          email: `${phone.replace(/\D/g, '')}@phone.local`,
          isVerified: true,
          roleId: buyerRole.id,
        },
        include: { role: true },
      });

      logger.info({ userId: user.id, phone }, 'New user created via OTP');
    }

    // Generate tokens
    const tokens = await generateTokenPair(user);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, phone }, 'OTP verified successfully');

    return {
      user: this.sanitizeUser(user),
      tokens,
      isNewUser: !otpRequest.userId,
    };
  }

  // Resend OTP
  async resendOTP(phone) {
    // Invalidate existing OTPs
    await prisma.otpRequest.updateMany({
      where: {
        phone,
        verifiedAt: null,
      },
      data: {
        expiresAt: new Date(), // Expire immediately
      },
    });

    // Send new OTP
    return this.sendOTP(phone);
  }

  // Send SMS via provider (placeholder)
  async sendSMS(phone, otp) {
    // PLACEHOLDER: Implement actual SMS provider integration
    // Example providers: Twilio, Nexmo, AWS SNS
    
    logger.info({ phone, otp }, 'SMS would be sent (placeholder)');

    // Twilio example (uncomment and configure):
    /*
    const twilio = require('twilio');
    const client = twilio(env.SMS_API_KEY, env.SMS_API_SECRET);
    
    await client.messages.create({
      body: `Your verification code is: ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
      from: env.SMS_SENDER_ID,
      to: phone,
    });
    */

    // For development, log the OTP
    if (env.NODE_ENV === 'development') {
      logger.info({ phone, otp }, 'DEV MODE: OTP for testing');
    }

    return true;
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