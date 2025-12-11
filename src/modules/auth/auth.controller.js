// ===========================================
// AUTH CONTROLLER
// ===========================================

const { authService } = require('./auth.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse } = require('../../utils/response');
const { getDeviceInfo } = require('../../middleware/deviceTracking');

// Register
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  createdResponse(res, result, 'Registration successful');
});

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const deviceInfo = getDeviceInfo(req);
  const result = await authService.login(email, password, deviceInfo);
  successResponse(res, result, 'Login successful');
});

// Refresh token
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshToken(req.user, refreshToken);
  successResponse(res, tokens, 'Token refreshed');
});

// Logout
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  successResponse(res, null, 'Logged out successfully');
});

// Logout all sessions
const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  successResponse(res, null, 'All sessions logged out');
});

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  successResponse(res, null, result.message);
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.resetPassword(token, password);
  successResponse(res, null, result.message);
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  successResponse(res, null, result.message);
});

// Get current user
const me = asyncHandler(async (req, res) => {
  const { prisma } = require('../../config/database');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });
  successResponse(res, authService.sanitizeUser(user));
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  me,
};