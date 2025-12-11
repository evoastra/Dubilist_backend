// ===========================================
// ERROR HANDLER MIDDLEWARE
// ===========================================

const { logger } = require('../config/logger');
const { env } = require('../config/env');

// Custom API Error class
class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response formatter
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    },
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log the error
  logger.error({
    error: {
      message: err.message,
      code: err.code,
      stack: err.stack,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      userId: req.user?.id,
      ip: req.ip,
    },
  }, 'Error occurred');

  // Handle Prisma errors
  if (err.code?.startsWith('P')) {
    error = handlePrismaError(err);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'INVALID_TOKEN', 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'TOKEN_EXPIRED', 'Token has expired');
  }

  // Handle Joi validation errors
  if (err.name === 'ValidationError' || err.isJoi) {
    const details = err.details?.map(d => ({
      field: d.path?.join('.'),
      message: d.message,
    }));
    error = new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError(400, 'FILE_TOO_LARGE', 'File size exceeds the limit');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ApiError(400, 'UNEXPECTED_FILE', 'Unexpected file field');
  }

  // Default to 500 if no status code
  const statusCode = error.statusCode || 500;
  const includeStack = env.NODE_ENV === 'development';

  res.status(statusCode).json(formatErrorResponse(error, includeStack));
};

// Handle Prisma-specific errors
const handlePrismaError = (err) => {
  switch (err.code) {
    case 'P2002': {
      const field = err.meta?.target?.[0] || 'field';
      return new ApiError(409, 'DUPLICATE_ENTRY', `A record with this ${field} already exists`);
    }
    case 'P2025':
      return new ApiError(404, 'NOT_FOUND', 'Record not found');
    case 'P2003':
      return new ApiError(400, 'FOREIGN_KEY_CONSTRAINT', 'Invalid reference to related record');
    case 'P2014':
      return new ApiError(400, 'RELATION_VIOLATION', 'The change violates a required relation');
    default:
      return new ApiError(500, 'DATABASE_ERROR', 'A database error occurred');
  }
};

// 404 Not Found handler
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`);
  next(error);
};

// Async handler wrapper to catch errors in async routes
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
};