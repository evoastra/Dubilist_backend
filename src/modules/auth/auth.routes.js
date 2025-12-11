// ===========================================
// AUTH ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { validateBody } = require('../../middleware/validation');
const { authenticate, verifyRefreshToken } = require('../../middleware/authMiddleware');
const { authRateLimiter } = require('../../middleware/rateLimiter');
const { trackDevice } = require('../../middleware/deviceTracking');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('./auth.validation');

// Public routes with rate limiting
router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  trackDevice,
  authController.login
);

router.post(
  '/refresh',
  validateBody(refreshSchema),
  verifyRefreshToken,
  authController.refresh
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

// Protected routes
router.post(
  '/logout',
  authenticate,
  validateBody(refreshSchema),
  authController.logout
);

router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword
);

router.get(
  '/me',
  authenticate,
  authController.me
);

module.exports = router;