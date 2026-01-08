// ===========================================
// ADMIN VALIDATION - Request Validation Schemas
// ===========================================

const Joi = require('joi');

// ==========================================
// AUTH
// ==========================================

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required'
  })
});

// ==========================================
// USER MANAGEMENT
// ==========================================

const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid('admin', 'moderator', 'seller', 'buyer'),
  isBlocked: Joi.string().valid('true', 'false'),
  search: Joi.string().max(100).trim()
});

const blockUserSchema = Joi.object({
  isBlocked: Joi.boolean().required().messages({
    'any.required': 'isBlocked field is required'
  })
});

const updateRoleSchema = Joi.object({
  roleName: Joi.string().valid('admin', 'moderator', 'seller', 'buyer').required().messages({
    'any.required': 'Role name is required',
    'any.only': 'Invalid role name'
  })
});

const postingRestrictionSchema = Joi.object({
  restrict: Joi.boolean().required().messages({
    'any.required': 'restrict field is required'
  })
});

const auditLogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  action: Joi.string().max(50),
  userId: Joi.number().integer().positive()
});

const suspendListingSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Reason must be at least 10 characters',
    'string.max': 'Reason cannot exceed 500 characters',
    'any.required': 'Reason is required'
  })
});

// ==========================================
// LISTING MANAGEMENT
// ==========================================

const getListingsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'pending', 'approved', 'rejected', 'sold', 'expired'),
  search: Joi.string().max(200).trim()
});

const updateListingStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'pending').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Invalid status. Must be approved, rejected, or pending'
  }),
  reasonRejected: Joi.string().max(500).trim().allow(null, '').messages({
    'string.max': 'Reason cannot exceed 500 characters'
  })
});

// ==========================================
// REPORTS
// ==========================================

const getReportsQuerySchema = Joi.object({
  type: Joi.string().valid('all', 'listing', 'user').default('all'),
  status: Joi.string().valid('pending', 'reviewed', 'dismissed', 'actioned', 'all').default('pending'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const updateReportStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewed', 'dismissed', 'actioned').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Invalid status'
  })
});

// ==========================================
// SUPPORT TICKETS
// ==========================================

const getSupportTicketsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('open', 'closed', 'pending'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent')
});

const replyToTicketSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 2000 characters',
    'any.required': 'Message is required'
  }),
  status: Joi.string().valid('open', 'closed', 'pending').messages({
    'any.only': 'Invalid status'
  })
});

// ==========================================
// ANALYTICS
// ==========================================

const getAnalyticsOverviewQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30).messages({
    'number.min': 'Days must be at least 1',
    'number.max': 'Days cannot exceed 365'
  })
});

const getPopularSearchesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// ==========================================
// FRAUD LOGS
// ==========================================

const getFraudLogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  isReviewed: Joi.string().valid('true', 'false')
});

// ==========================================
// CATEGORIES
// ==========================================

const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Name is required'
  }),
  slug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).required().messages({
    'string.min': 'Slug must be at least 2 characters',
    'string.max': 'Slug cannot exceed 100 characters',
    'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens',
    'any.required': 'Slug is required'
  }),
  description: Joi.string().max(500).allow(null, '').messages({
    'string.max': 'Description cannot exceed 500 characters'
  }),
  parentId: Joi.number().integer().positive().allow(null).messages({
    'number.positive': 'Parent ID must be a positive number'
  }),
  orderIndex: Joi.number().integer().min(0).default(0).messages({
    'number.min': 'Order index cannot be negative'
  })
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 100 characters'
  }),
  slug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).messages({
    'string.min': 'Slug must be at least 2 characters',
    'string.max': 'Slug cannot exceed 100 characters',
    'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
  }),
  description: Joi.string().max(500).allow(null, ''),
  parentId: Joi.number().integer().positive().allow(null),
  orderIndex: Joi.number().integer().min(0),
  isActive: Joi.boolean()
});

// ==========================================
// SYSTEM CONFIG
// ==========================================

const updateSystemConfigSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean()
  )
).min(1).messages({
  'object.min': 'At least one config value is required'
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors
        }
      });
    }

    req[property] = value;
    next();
  };
};

module.exports = {
  // Validation middleware
  validate,

  // Auth
  loginSchema,

  // User management
  getUsersQuerySchema,
  blockUserSchema,
  updateRoleSchema,
  postingRestrictionSchema,
  auditLogsQuerySchema,
  suspendListingSchema,

  // Listing management
  getListingsQuerySchema,
  updateListingStatusSchema,

  // Reports
  getReportsQuerySchema,
  updateReportStatusSchema,

  // Support tickets
  getSupportTicketsQuerySchema,
  replyToTicketSchema,

  // Analytics
  getAnalyticsOverviewQuerySchema,
  getPopularSearchesQuerySchema,

  // Fraud logs
  getFraudLogsQuerySchema,

  // Categories
  createCategorySchema,
  updateCategorySchema,

  // System config
  updateSystemConfigSchema
};