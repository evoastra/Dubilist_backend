// ===========================================
// ADMIN ROUTES - All Admin Endpoints
// ===========================================

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');
const { validate } = require('./admin.validation');
const {
  loginSchema,
  getUsersQuerySchema,
  blockUserSchema,
  updateRoleSchema,
  postingRestrictionSchema,
  auditLogsQuerySchema,
  suspendListingSchema,
  getListingsQuerySchema,
  updateListingStatusSchema,
  getReportsQuerySchema,
  updateReportStatusSchema,
  getSupportTicketsQuerySchema,
  replyToTicketSchema,
  getAnalyticsOverviewQuerySchema,
  getPopularSearchesQuerySchema,
  getFraudLogsQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  updateSystemConfigSchema
} = require('./admin.validation');

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================

/**
 * @route   POST /api/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/login', validate(loginSchema), adminController.login);

// ==========================================
// PROTECTED ROUTES (Admin Only)
// ==========================================

// Apply auth middleware to all routes below
router.use(authenticate, requireAdmin);

// ==========================================
// DASHBOARD
// ==========================================

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', adminController.getDashboard);

// ==========================================
// USER MANAGEMENT
// ==========================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin
 */
router.get('/users', validate(getUsersQuerySchema, 'query'), adminController.getUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user details
 * @access  Admin
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @route   PATCH /api/admin/users/:id/block
 * @desc    Block or unblock user
 * @access  Admin
 */
router.patch('/users/:id/block', validate(blockUserSchema), adminController.blockUser);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role
 * @access  Admin
 */
router.patch('/users/:id/role', validate(updateRoleSchema), adminController.updateUserRole);

/**
 * @route   PUT /api/admin/users/:id/restrict-posting
 * @desc    Restrict user from posting listings
 * @access  Admin
 */
router.put('/users/:id/restrict-posting', validate(postingRestrictionSchema), adminController.togglePostingRestriction);

/**
 * @route   PUT /api/admin/users/:id/unrestrict-posting
 * @desc    Unrestrict user from posting listings
 * @access  Admin
 */
router.put('/users/:id/unrestrict-posting', validate(postingRestrictionSchema), adminController.togglePostingRestriction);

/**
 * @route   POST /api/admin/users/:id/impersonate
 * @desc    Generate impersonation tokens for user
 * @access  Admin
 */
router.post('/users/:id/impersonate', adminController.impersonateUser);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs
 * @access  Admin
 */
router.get('/audit-logs', validate(auditLogsQuerySchema, 'query'), adminController.getAuditLogs);

// ==========================================
// LISTING MANAGEMENT
// ==========================================

/**
 * @route   GET /api/admin/listings
 * @desc    Get all listings with filters
 * @access  Admin
 */
router.get('/listings', validate(getListingsQuerySchema, 'query'), adminController.getListings);

/**
 * @route   PATCH /api/admin/listings/:id/status
 * @desc    Approve or reject listing
 * @access  Admin
 */
router.patch('/listings/:id/status', validate(updateListingStatusSchema), adminController.updateListingStatus);

/**
 * @route   POST /api/admin/listings/:id/suspend
 * @desc    Suspend listing with reason
 * @access  Admin
 */
router.post('/listings/:id/suspend', validate(suspendListingSchema), adminController.suspendListing);

// ==========================================
// REPORTS
// ==========================================

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports (listings & users)
 * @access  Admin
 */
router.get('/reports', validate(getReportsQuerySchema, 'query'), adminController.getReports);

/**
 * @route   PATCH /api/admin/reports/:type/:id
 * @desc    Update report status
 * @access  Admin
 */
router.patch('/reports/:type/:id', validate(updateReportStatusSchema), adminController.updateReportStatus);

// ==========================================
// SUPPORT TICKETS
// ==========================================

/**
 * @route   GET /api/admin/support/tickets
 * @desc    Get all support tickets
 * @access  Admin
 */
router.get('/support/tickets', validate(getSupportTicketsQuerySchema, 'query'), adminController.getSupportTickets);

/**
 * @route   POST /api/admin/support/tickets/:id/reply
 * @desc    Reply to support ticket
 * @access  Admin
 */
router.post('/support/tickets/:id/reply', validate(replyToTicketSchema), adminController.replyToTicket);

// ==========================================
// ANALYTICS
// ==========================================

/**
 * @route   GET /api/admin/analytics/overview
 * @desc    Get analytics overview
 * @access  Admin
 */
router.get('/analytics/overview', validate(getAnalyticsOverviewQuerySchema, 'query'), adminController.getAnalyticsOverview);

/**
 * @route   GET /api/admin/analytics/popular-searches
 * @desc    Get popular search queries
 * @access  Admin
 */
router.get('/analytics/popular-searches', validate(getPopularSearchesQuerySchema, 'query'), adminController.getPopularSearches);

/**
 * @route   GET /api/admin/analytics/categories
 * @desc    Get category statistics
 * @access  Admin
 */
router.get('/analytics/categories', adminController.getCategoryStats);

// ==========================================
// FRAUD LOGS
// ==========================================

/**
 * @route   GET /api/admin/fraud-logs
 * @desc    Get fraud detection logs
 * @access  Admin
 */
router.get('/fraud-logs', validate(getFraudLogsQuerySchema, 'query'), adminController.getFraudLogs);

/**
 * @route   PATCH /api/admin/fraud-logs/:id/review
 * @desc    Mark fraud log as reviewed
 * @access  Admin
 */
router.patch('/fraud-logs/:id/review', adminController.reviewFraudLog);

// ==========================================
// ROLES
// ==========================================

/**
 * @route   GET /api/admin/roles
 * @desc    Get all roles
 * @access  Admin
 */
router.get('/roles', adminController.getRoles);

// ==========================================
// CATEGORIES
// ==========================================

/**
 * @route   POST /api/admin/categories
 * @desc    Create new category
 * @access  Admin
 */
router.post('/categories', validate(createCategorySchema), adminController.createCategory);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update category
 * @access  Admin
 */
router.put('/categories/:id', validate(updateCategorySchema), adminController.updateCategory);

/**
 * @route   POST /api/admin/categories/:id/image
 * @desc    Upload category image
 * @access  Admin
 * @note    Handled by upload module
 */
// This route will be in the upload module

// ==========================================
// SYSTEM CONFIG
// ==========================================

/**
 * @route   GET /api/admin/config
 * @desc    Get system configuration
 * @access  Admin
 */
router.get('/config', adminController.getSystemConfig);

/**
 * @route   PUT /api/admin/config
 * @desc    Update system configuration
 * @access  Admin
 */
router.put('/config', validate(updateSystemConfigSchema), adminController.updateSystemConfig);

module.exports = router;