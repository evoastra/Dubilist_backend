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

module.exports = {
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