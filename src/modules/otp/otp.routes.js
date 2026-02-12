// ===========================================
// OTP ROUTES (Updated)
// ===========================================

const express = require('express');
const router = express.Router();
const otpController = require('./otp.controller');
const { validateBody, Joi } = require('../../middleware/validation');
const { otpRateLimiter } = require('../../middleware/rateLimiter');

// Validation schemas
const emailSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});

const verifyPasswordResetSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  otp: Joi.string().length(6).pattern(/^\d+$/).required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required',
    }),
});

const phoneSchema = Joi.object({
  phone: Joi.string().pattern(/^[+]?[\d\s-]+$/).min(8).max(20).required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required',
    }),
});

const verifySchema = Joi.object({
  phone: Joi.string().pattern(/^[+]?[\d\s-]+$/).min(8).max(20).required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required',
    }),
  otp: Joi.string().length(6).pattern(/^\d+$/).required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required',
    }),
});

// Password Reset Routes
router.post(
  '/password-reset/send',
  otpRateLimiter,
  validateBody(emailSchema),
  otpController.sendPasswordResetOTP
);

router.post(
  '/password-reset/verify',
  validateBody(verifyPasswordResetSchema),
  otpController.verifyPasswordResetOTP
);

// Phone OTP Routes
router.post(
  '/send',
  otpRateLimiter,
  validateBody(phoneSchema),
  otpController.sendOTP
);

router.post(
  '/verify',
  validateBody(verifySchema),
  otpController.verifyOTP
);

router.post(
  '/resend',
  otpRateLimiter,
  validateBody(phoneSchema),
  otpController.resendOTP
);

module.exports = router;