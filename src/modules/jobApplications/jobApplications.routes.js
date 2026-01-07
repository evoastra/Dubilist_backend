// ===========================================
// JOB APPLICATIONS ROUTES
// File: src/modules/jobApplications/jobApplications.routes.js
// ===========================================

const express = require('express');
const router = express.Router();

const jobApplicationsController = require('./jobApplications.controller');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');

// ===========================================
// APPLICANT ROUTES (Job Seekers)
// ===========================================

/**
 * POST /api/listings/:listingId/apply
 * Apply to a job
 */
router.post('/listings/:listingId/apply', authenticate, jobApplicationsController.applyToJob);

/**
 * GET /api/applications/my
 * Get my applications
 */
router.get('/applications/my', authenticate, jobApplicationsController.getMyApplications);

/**
 * GET /api/applications/:id
 * Get single application
 */
router.get('/applications/:id', authenticate, jobApplicationsController.getApplicationById);

/**
 * DELETE /api/applications/:id
 * Withdraw application
 */
router.delete('/applications/:id', authenticate, jobApplicationsController.withdrawApplication);

// ===========================================
// JOB POSTER ROUTES (Employers)
// ===========================================

/**
 * GET /api/listings/:listingId/applications
 * Get applications for a specific job
 */
router.get('/listings/:listingId/applications', authenticate, jobApplicationsController.getJobApplications);

/**
 * GET /api/listings/my-jobs/applications
 * Get all applications for my jobs
 */
router.get('/listings/my-jobs/applications', authenticate, jobApplicationsController.getMyJobsApplications);

/**
 * PATCH /api/applications/:id/status
 * Update application status
 */
router.patch('/applications/:id/status', authenticate, jobApplicationsController.updateApplicationStatus);

/**
 * POST /api/applications/:id/shortlist
 * Shortlist application
 */
router.post('/applications/:id/shortlist', authenticate, jobApplicationsController.shortlistApplication);

/**
 * POST /api/applications/:id/accept
 * Accept application
 */
router.post('/applications/:id/accept', authenticate, jobApplicationsController.acceptApplication);

/**
 * POST /api/applications/:id/reject
 * Reject application
 */
router.post('/applications/:id/reject', authenticate, jobApplicationsController.rejectApplication);

// ===========================================
// ADMIN ROUTES
// ===========================================

/**
 * GET /api/admin/applications
 * Get all applications (Admin)
 */
router.get('/admin/applications', authenticate, requireAdmin, jobApplicationsController.adminGetAllApplications);

module.exports = router;