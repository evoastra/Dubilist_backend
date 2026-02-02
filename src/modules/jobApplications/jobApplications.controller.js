// ===========================================
// JOB APPLICATIONS CONTROLLER
// File: src/modules/jobApplications/jobApplications.controller.js
// ===========================================

const jobApplicationsService = require('./jobApplications.service');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

// ===========================================
// APPLICANT METHODS (Job Seekers)
// ===========================================

/**
 * POST /api/listings/:listingId/apply
 * Apply to a job listing
 */
const applyToJob = async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);
    
    if (isNaN(listingId)) {
      return sendError(res, 'Invalid listing ID', 400);
    }

    // Check if listing exists and is a job
    const listing = await jobApplicationsService.getJobListing(listingId);
    if (!listing) {
      return sendError(res, 'Job listing not found', 404);
    }

    if (listing.categoryId !== 2) {
      return sendError(res, 'This is not a job listing', 400);
    }

    if (listing.status !== 'approved') {
      return sendError(res, 'This job is not active', 400);
    }

    // Can't apply to your own job
    if (listing.userId === req.user.id) {
      return sendError(res, 'Cannot apply to your own job listing', 400);
    }



    
    // Check if already applied
    const existingApplication = await jobApplicationsService.getUserApplicationForJob(
      req.user.id,
      listingId
    );

    if (existingApplication) {
      return sendError(res, 'You have already applied to this job', 409);
    }

    const applicationData = {
      jobListingId: listingId,
      userId: req.user.id,
      
      // Applicant Info (auto-fill from user, can be overridden)
      name: req.body.name || req.user.name,
      dob: req.body.dob ? new Date(req.body.dob) : null,
      email: req.body.email || req.user.email,
      mobileNo: req.body.mobileNo || req.body.mobile_no || req.body.phone || req.user.phone,
      languages: req.body.languages,
      nationality: req.body.nationality,
      location: req.body.location,
      visaStatus: req.body.visaStatus || req.body.visa_status,
      
      // Resume (required)
      resumeUrl: req.body.resumeUrl || req.body.resume_url,
      resumeS3Key: req.body.resumeS3Key || req.body.resume_s3_key,
      
      // Qualifications
      qualification: req.body.qualification,
      jobStatus: req.body.jobStatus || req.body.job_status,
      yearsOfExperience: req.body.yearsOfExperience || req.body.years_of_experience,
      
      // Salary
      salaryExpectation: req.body.salaryExpectation || req.body.salary_expectation,
      salaryCurrency: req.body.salaryCurrency || req.body.salary_currency || 'AED',
      
      // Additional
      coverLetter: req.body.coverLetter || req.body.cover_letter,
      portfolioUrl: req.body.portfolioUrl || req.body.portfolio_url,
      linkedinUrl: req.body.linkedinUrl || req.body.linkedin_url
    };

    // Validation
    if (!applicationData.name) {
      return sendError(res, 'Name is required', 400);
    }

    if (!applicationData.email) {
      return sendError(res, 'Email is required', 400);
    }

    if (!applicationData.mobileNo) {
      return sendError(res, 'Mobile number is required', 400);
    }

    if (!applicationData.jobStatus) {
      return sendError(res, 'Job status (fresher/experienced) is required', 400);
    }

    if (!applicationData.resumeUrl) {
      return sendError(res, 'Resume is required. Please upload your resume first.', 400);
    }

    // Create application
    const application = await jobApplicationsService.createApplication(applicationData);

    // Notify job poster
    await jobApplicationsService.notifyJobPosterNewApplication(application.id).catch(err =>
      console.error('Notification error:', err)
    );

    return sendSuccess(res, application, 'Application submitted successfully', 201);
  } catch (error) {
    console.error('Apply to job error:', error);
     console.error('Apply to job error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return sendError(res, 'Failed to submit application', 500);
  }
};

/**
 * GET /api/applications/my
 * Get current user's job applications
 */
const getMyApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const filters = {
      userId: req.user.id,
      status
    };

    const result = await jobApplicationsService.getUserApplications({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    return sendPaginated(res, result.applications, result.pagination);
  } catch (error) {
    console.error('Get my applications error:', error);
    return sendError(res, 'Failed to get applications', 500);
  }
};

/**
 * GET /api/applications/:id
 * Get single application details
 */
const getApplicationById = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    // Check authorization (applicant or job poster)
    if (application.userId !== req.user.id && 
        application.jobListing.userId !== req.user.id &&
        req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to view this application', 403);
    }

    return sendSuccess(res, application);
  } catch (error) {
    console.error('Get application error:', error);
    return sendError(res, 'Failed to get application', 500);
  }
};

/**
 * DELETE /api/applications/:id
 * Withdraw application (before review)
 */
const withdrawApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    if (application.userId !== req.user.id) {
      return sendError(res, 'Not authorized to withdraw this application', 403);
    }

    if (['accepted', 'rejected'].includes(application.status)) {
      return sendError(res, 'Cannot withdraw application that has been processed', 400);
    }

    // Delete application and resume from S3
    await jobApplicationsService.deleteApplication(applicationId);

    return sendSuccess(res, null, 'Application withdrawn successfully');
  } catch (error) {
    console.error('Withdraw application error:', error);
    return sendError(res, 'Failed to withdraw application', 500);
  }
};

// ===========================================
// JOB POSTER METHODS (Employers)
// ===========================================

/**
 * GET /api/listings/:listingId/applications
 * Get all applications for a job listing (job poster only)
 */
const getJobApplications = async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);
    
    if (isNaN(listingId)) {
      return sendError(res, 'Invalid listing ID', 400);
    }

    // Check listing ownership
    const listing = await jobApplicationsService.getJobListing(listingId);
    if (!listing) {
      return sendError(res, 'Job listing not found', 404);
    }

    if (listing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to view applications for this job', 403);
    }

    const { page = 1, limit = 20, status } = req.query;

    const filters = {
      jobListingId: listingId,
      status
    };

    const result = await jobApplicationsService.getJobApplications({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    return sendPaginated(res, result.applications, result.pagination, { 
      stats: result.stats 
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    return sendError(res, 'Failed to get applications', 500);
  }
};

/**
 * GET /api/listings/my-jobs/applications
 * Get all applications for all jobs posted by current user
 */
const getMyJobsApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, jobListingId } = req.query;

    const filters = {
      employerId: req.user.id,
      status,
      jobListingId: jobListingId ? parseInt(jobListingId) : undefined
    };

    const result = await jobApplicationsService.getEmployerApplications({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    return sendPaginated(res, result.applications, result.pagination, {
      stats: result.stats
    });
  } catch (error) {
    console.error('Get employer applications error:', error);
    return sendError(res, 'Failed to get applications', 500);
  }
};

/**
 * PATCH /api/applications/:id/status
 * Update application status (job poster only)
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    const { status, employerNotes } = req.body;
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const validStatuses = ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    // Check if user is the job poster
    if (application.jobListing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized to update this application', 403);
    }

    const updated = await jobApplicationsService.updateApplicationStatus(applicationId, {
      status,
      employerNotes,
      reviewedBy: req.user.id
    });

    // Notify applicant
    await jobApplicationsService.notifyApplicantStatusUpdate(applicationId).catch(err =>
      console.error('Notification error:', err)
    );

    return sendSuccess(res, updated, 'Application status updated successfully');
  } catch (error) {
    console.error('Update application status error:', error);
    return sendError(res, 'Failed to update application status', 500);
  }
};

/**
 * POST /api/applications/:id/shortlist
 * Shortlist an application
 */
const shortlistApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    if (application.jobListing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await jobApplicationsService.updateApplicationStatus(applicationId, {
      status: 'shortlisted',
      employerNotes: req.body.notes,
      reviewedBy: req.user.id
    });

    await jobApplicationsService.notifyApplicantStatusUpdate(applicationId).catch(err =>
      console.error('Notification error:', err)
    );

    return sendSuccess(res, updated, 'Application shortlisted');
  } catch (error) {
    console.error('Shortlist application error:', error);
    return sendError(res, 'Failed to shortlist application', 500);
  }
};

/**
 * POST /api/applications/:id/accept
 * Accept an application
 */
const acceptApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    if (application.jobListing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await jobApplicationsService.updateApplicationStatus(applicationId, {
      status: 'accepted',
      employerNotes: req.body.notes,
      reviewedBy: req.user.id
    });

    await jobApplicationsService.notifyApplicantStatusUpdate(applicationId).catch(err =>
      console.error('Notification error:', err)
    );

    return sendSuccess(res, updated, 'Application accepted');
  } catch (error) {
    console.error('Accept application error:', error);
    return sendError(res, 'Failed to accept application', 500);
  }
};

/**
 * POST /api/applications/:id/reject
 * Reject an application
 */
const rejectApplication = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return sendError(res, 'Invalid application ID', 400);
    }

    const application = await jobApplicationsService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    if (application.jobListing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await jobApplicationsService.updateApplicationStatus(applicationId, {
      status: 'rejected',
      employerNotes: req.body.notes,
      reviewedBy: req.user.id
    });

    await jobApplicationsService.notifyApplicantStatusUpdate(applicationId).catch(err =>
      console.error('Notification error:', err)
    );

    return sendSuccess(res, updated, 'Application rejected');
  } catch (error) {
    console.error('Reject application error:', error);
    return sendError(res, 'Failed to reject application', 500);
  }
};

// ===========================================
// ADMIN METHODS
// ===========================================

/**
 * GET /api/admin/applications
 * Get all applications (Admin)
 */
const adminGetAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, jobListingId, userId } = req.query;

    const filters = {
      status,
      jobListingId: jobListingId ? parseInt(jobListingId) : undefined,
      userId: userId ? parseInt(userId) : undefined
    };

    const result = await jobApplicationsService.adminGetAllApplications({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    return sendPaginated(res, result.applications, result.pagination, {
      stats: result.stats
    });
  } catch (error) {
    console.error('Admin get applications error:', error);
    return sendError(res, 'Failed to get applications', 500);
  }
};

module.exports = {
  applyToJob,
  getMyApplications,
  getApplicationById,
  withdrawApplication,
  getJobApplications,
  getMyJobsApplications,
  updateApplicationStatus,
  shortlistApplication,
  acceptApplication,
  rejectApplication,
  adminGetAllApplications
};