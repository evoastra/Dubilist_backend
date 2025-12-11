// ===========================================
// XSS FILTER MIDDLEWARE
// ===========================================

const xss = require('xss');

// XSS filter options
const xssOptions = {
  whiteList: {}, // Empty whitelist - strip all HTML
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'],
};

// Recursively sanitize object values
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
};

// Sanitize all string values in an object
const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
};

// XSS filter middleware
const xssFilter = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query params
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize params
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = { xssFilter, sanitizeObject, sanitizeValue };