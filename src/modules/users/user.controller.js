// ===========================================
// USER CONTROLLER
// ===========================================

const { userService } = require('./user.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, paginatedResponse } = require('../../utils/response');

// Get current user
const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.id);
  successResponse(res, user);
});

// Get user profile (public)
const getProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await userService.getUserProfile(parseInt(id, 10));
  successResponse(res, user);
});

// Update profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, user, 'Profile updated successfully');
});

// Get user sessions
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await userService.getUserSessions(req.user.id);
  successResponse(res, sessions);
});

// Delete session
const deleteSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await userService.deleteSession(req.user.id, parseInt(id, 10));
  successResponse(res, null, 'Session deleted');
});

// Deactivate account
const deactivateAccount = asyncHandler(async (req, res) => {
  const result = await userService.deactivateAccount(req.user.id);
  successResponse(res, null, result.message);
});

// Get user's listings
const getMyListings = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await userService.getUserListings(req.user.id, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    status,
  });
  paginatedResponse(res, result);
});

// Export user data
const exportData = asyncHandler(async (req, res) => {
  const data = await userService.exportUserData(req.user.id);
  successResponse(res, data, 'User data exported');
});

module.exports = {
  getMe,
  getProfile,
  updateProfile,
  getSessions,
  deleteSession,
  deactivateAccount,
  getMyListings,
  exportData,
};

