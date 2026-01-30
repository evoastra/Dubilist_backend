// ===========================================
// JOB APPLICATIONS SERVICE
// File: src/modules/jobApplications/jobApplications.service.js
// ===========================================

const { prisma } = require('../../config/database');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'dubilist-images';

// ===========================================
// APPLICATION SELECT OBJECTS
// ===========================================

const APPLICATION_SELECT = {
  id: true,
  jobListingId: true,
  userId: true,
  name: true,
  dob: true,
  email: true,
  mobileNo: true,
  languages: true,
  nationality: true,
  location: true,
  visaStatus: true,
  resumeUrl: true,
  resumeS3Key: true,
  qualification: true,
  jobStatus: true,
  yearsOfExperience: true,
  salaryExpectation: true,
  salaryCurrency: true,
  coverLetter: true,
  portfolioUrl: true,
  linkedinUrl: true,
  status: true,
  employerNotes: true,
  reviewedAt: true,
  reviewedBy: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true
    }
  },
  jobListing: {
    select: {
      id: true,
      title: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      jobDetails: {
        select: {
          jobTitle: true,
          companyName: true,
          industry: true,
          jobType: true
        }
      }
    }
  }
};

const APPLICATION_LIST_SELECT = {
  id: true,
  jobListingId: true,
  userId: true,
  name: true,
  email: true,
  mobileNo: true,
  nationality: true,
  location: true,
  qualification: true,
  jobStatus: true,
  yearsOfExperience: true,
  salaryExpectation: true,
  salaryCurrency: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      avatarUrl: true
    }
  },
  jobListing: {
    select: {
      id: true,
      title: true,
      jobDetails: {
        select: {
          jobTitle: true,
          companyName: true
        }
      }
    }
  }
};

// ===========================================
// PUBLIC METHODS
// ===========================================

/**
 * Get job listing
 */
const getJobListing = async (listingId) => {
  return prisma.listing.findFirst({
    where: {
      id: listingId,
      isDeleted: false,
      categoryId: 2 // Jobs category
    },
    select: {
      id: true,
      userId: true,
      title: true,
      categoryId: true,
      status: true
    }
  });
};

/**
 * Check if user already applied
 */
const getUserApplicationForJob = async (userId, jobListingId) => {
  return prisma.jobApplication.findFirst({
    where: {
      userId,
      jobListingId
    }
  });
};

/**
 * Create application
 */
const createApplication = async (data) => {
  return prisma.jobApplication.create({
    data: {
      jobListingId: data.jobListingId,
      userId: data.userId,
      name: data.name,
      dob: data.dob,
      email: data.email,
      mobileNo: data.mobileNo,
      languages: data.languages ? (typeof data.languages === 'string' ? JSON.parse(data.languages) : data.languages) : null,
      nationality: data.nationality,
      location: data.location,
      visaStatus: data.visaStatus,
      resumeUrl: data.resumeUrl,
      resumeS3Key: data.resumeS3Key,
      qualification: data.qualification,
       languages: parsedLanguages,
      jobStatus: data.jobStatus,
      yearsOfExperience: data.yearsOfExperience ? parseInt(data.yearsOfExperience) : null,
      salaryExpectation: data.salaryExpectation ? parseFloat(data.salaryExpectation) : null,
      salaryCurrency: data.salaryCurrency || 'AED',
      coverLetter: data.coverLetter,
      portfolioUrl: data.portfolioUrl,
      linkedinUrl: data.linkedinUrl
    },
    select: APPLICATION_SELECT
  });
};

/**
 * Get user's applications
 */
const getUserApplications = async ({ page, limit, filters }) => {
  const skip = (page - 1) * limit;

  const where = {
    userId: filters.userId,
    ...(filters.status && { status: filters.status })
  };

  const [applications, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: APPLICATION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.jobApplication.count({ where })
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get application by ID
 */
const getApplicationById = async (applicationId) => {
  return prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: APPLICATION_SELECT
  });
};

/**
 * Delete application
 */
const deleteApplication = async (applicationId) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: { resumeS3Key: true }
  });

  // Delete resume from S3
  if (application?.resumeS3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: application.resumeS3Key
      });
      await s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete resume from S3:', error);
    }
  }

  // Delete application from database
  return prisma.jobApplication.delete({
    where: { id: applicationId }
  });
};

/**
 * Get applications for a job
 */
const getJobApplications = async ({ page, limit, filters }) => {
  const skip = (page - 1) * limit;

  const where = {
    jobListingId: filters.jobListingId,
    ...(filters.status && { status: filters.status })
  };

  const [applications, total, stats] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: APPLICATION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.jobApplication.count({ where }),
    // Get status statistics
    prisma.jobApplication.groupBy({
      by: ['status'],
      where: { jobListingId: filters.jobListingId },
      _count: { status: true }
    })
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: stats.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {})
  };
};

/**
 * Get all applications for employer's jobs
 */
const getEmployerApplications = async ({ page, limit, filters }) => {
  const skip = (page - 1) * limit;

  const where = {
    jobListing: {
      userId: filters.employerId,
      isDeleted: false
    },
    ...(filters.status && { status: filters.status }),
    ...(filters.jobListingId && { jobListingId: filters.jobListingId })
  };

  const [applications, total, stats] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: APPLICATION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.jobApplication.count({ where }),
    prisma.jobApplication.groupBy({
      by: ['status'],
      where: {
        jobListing: {
          userId: filters.employerId,
          isDeleted: false
        }
      },
      _count: { status: true }
    })
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: stats.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {})
  };
};

/**
 * Update application status
 */
const updateApplicationStatus = async (applicationId, data) => {
  return prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      status: data.status,
      employerNotes: data.employerNotes,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date()
    },
    select: APPLICATION_SELECT
  });
};

/**
 * Admin get all applications
 */
const adminGetAllApplications = async ({ page, limit, filters }) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.jobListingId && { jobListingId: filters.jobListingId }),
    ...(filters.userId && { userId: filters.userId })
  };

  const [applications, total, stats] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: APPLICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.jobApplication.count({ where }),
    prisma.jobApplication.groupBy({
      by: ['status'],
      _count: { status: true }
    })
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: stats.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {})
  };
};

// ===========================================
// NOTIFICATION HELPERS
// ===========================================

/**
 * Notify job poster of new application
 */
const notifyJobPosterNewApplication = async (applicationId) => {
  const application = await getApplicationById(applicationId);
  if (!application) return;

  const jobPosterId = application.jobListing.userId;

  await prisma.notification.create({
    data: {
      userId: jobPosterId,
      type: 'job_application_new',
      title: 'New Job Application',
      message: `${application.name} applied for ${application.jobListing.title}`,
      data: {
        applicationId: application.id,
        jobListingId: application.jobListingId,
        applicantName: application.name
      }
    }
  }).catch(err => console.error('Notification error:', err));
};

/**
 * Notify applicant of status update
 */
const notifyApplicantStatusUpdate = async (applicationId) => {
  const application = await getApplicationById(applicationId);
  if (!application) return;

  const statusMessages = {
    reviewing: 'Your application is being reviewed',
    shortlisted: 'Congratulations! You have been shortlisted',
    accepted: 'Congratulations! Your application has been accepted',
    rejected: 'Your application has been reviewed'
  };

  const message = statusMessages[application.status] || 'Application status updated';

  await prisma.notification.create({
    data: {
      userId: application.userId,
      type: 'job_application_status',
      title: 'Application Status Update',
      message: `${message} for ${application.jobListing.title}`,
      data: {
        applicationId: application.id,
        jobListingId: application.jobListingId,
        status: application.status
      }
    }
  }).catch(err => console.error('Notification error:', err));
};

module.exports = {
  getJobListing,
  getUserApplicationForJob,
  createApplication,
  getUserApplications,
  getApplicationById,
  deleteApplication,
  getJobApplications,
  getEmployerApplications,
  updateApplicationStatus,
  adminGetAllApplications,
  notifyJobPosterNewApplication,
  notifyApplicantStatusUpdate
};  