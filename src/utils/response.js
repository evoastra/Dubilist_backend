// ===========================================
// RESPONSE HELPER UTILITY
// ===========================================

// Standard success response
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

// Created response (201)
const createdResponse = (res, data, message = 'Created successfully') => {
  return successResponse(res, data, message, 201);
};

// No content response (204)
const noContentResponse = (res) => {
  return res.status(204).send();
};

// Paginated response
const paginatedResponse = (res, { data, pagination }, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

// Error response
const errorResponse = (res, code, message, statusCode = 400, details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
};

// Not found response
const notFoundResponse = (res, resource = 'Resource') => {
  return errorResponse(res, 'NOT_FOUND', `${resource} not found`, 404);
};

// Unauthorized response
const unauthorizedResponse = (res, message = 'Unauthorized') => {
  return errorResponse(res, 'UNAUTHORIZED', message, 401);
};

// Forbidden response
const forbiddenResponse = (res, message = 'Access denied') => {
  return errorResponse(res, 'FORBIDDEN', message, 403);
};

// Validation error response
const validationErrorResponse = (res, details) => {
  return errorResponse(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
};

// ===========================================
// RESPONSE UTILITY
// File: src/utils/response.util.js
// Standardized API responses matching your app.js pattern
// ===========================================

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    ...(message && { message }),
    ...(data !== null && data !== undefined && { data })
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {Object} details - Optional error details
 */
const sendError = (res, message, statusCode = 400, details = null) => {
  const response = {
    success: false,
    error: {
      message,
      ...(details && { details })
    }
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info { page, limit, total, pages }
 * @param {Object} extra - Additional data to include in response
 */
const sendPaginated = (res, data, pagination, extra = {}) => {
  return res.status(200).json({
    success: true,
    data,
    pagination,
    ...extra
  });
};

/**
 * Send created response (201)
 */
const sendCreated = (res, data, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send no content response (204)
 */
const sendNoContent = (res) => {
  return res.status(204).send();
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {Array} errors - Array of validation errors
 */
const sendValidationError = (res, errors) => {
  return res.status(400).json({
    success: false,
    error: {
      message: 'Validation failed',
      details: errors
    }
  });
};

/**
 * Send unauthorized response (401)
 */
const sendUnauthorized = (res, message = 'Unauthorized') => {
  return sendError(res, message, 401);
};

/**
 * Send forbidden response (403)
 */
const sendForbidden = (res, message = 'Access forbidden') => {
  return sendError(res, message, 403);
};

/**
 * Send not found response (404)
 */
const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, message, 404);
};

/**
 * Send conflict response (409)
 */
const sendConflict = (res, message = 'Resource already exists') => {
  return sendError(res, message, 409);
};

/**
 * Send server error response (500)
 */
const sendServerError = (res, message = 'Internal server error') => {
  return sendError(res, message, 500);
};



module.exports = {
    sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendServerError,
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
};