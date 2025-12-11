// ===========================================
// VALIDATION MIDDLEWARE (JOI)
// ===========================================

const Joi = require('joi');
const { ApiError } = require('./errorHandler');

// Validate request body
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);
    }

    req.body = value;
    next();
  };
};

// Validate query params
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query parameters', details);
    }

    req.query = value;
    next();
  };
};

// Validate params
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid path parameters', details);
    }

    req.params = value;
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  id: Joi.number().integer().positive().required(),
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  email: Joi.string().email().lowercase().trim(),
  
  phone: Joi.string().pattern(/^[+]?[\d\s-]+$/).min(8).max(20),
  
  password: Joi.string().min(8).max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),

  uuid: Joi.string().guid({ version: 'uuidv4' }),

  date: Joi.date().iso(),

  positiveNumber: Joi.number().positive(),

  stringArray: Joi.array().items(Joi.string()),

  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  Joi,
};