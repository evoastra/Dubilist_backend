// ===========================================
// DESIGNERS MODULE - VALIDATION
// File: src/modules/designers/designers.validation.js
// ===========================================

const expressValidator = require('express-validator');

const validationResult = expressValidator.validationResult;
const body = expressValidator.body;
const param = expressValidator.param;
const query = expressValidator.query;

// ===========================================
// VALIDATION HELPERS
// ===========================================

const VALID_SERVICES = [
  'Residential Design',
  'Commercial Design',
  'Office Design',
  'Retail Design',
  'Hospitality Design',
  'Consultation',
  'Space Planning',
  'Color Consultation',
  'Furniture Selection',
  'Renovation',
  'New Construction',
  'Kitchen Design',
  'Bathroom Design',
  'Landscape Design',
  'Lighting Design',
  '3D Visualization',
  'Project Management'
];

const VALID_SPECIALIZATIONS = [
  'Modern',
  'Contemporary',
  'Minimalist',
  'Classic',
  'Traditional',
  'Industrial',
  'Scandinavian',
  'Bohemian',
  'Mid-Century Modern',
  'Art Deco',
  'Rustic',
  'Coastal',
  'Mediterranean',
  'Japanese',
  'Luxury',
  'Sustainable',
  'Smart Home'
];

const VALID_PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Office',
  'Retail',
  'Hospitality',
  'Restaurant',
  'Healthcare',
  'Education',
  'Showroom'
];

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ===========================================
// VALIDATION MIDDLEWARE
// ===========================================

/**
 * Handle validation errors
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      }
    });
  }
  next();
};

/**
 * Validate create designer request
 */
const validateDesigner = [
  body('bio')
    .trim()
    .notEmpty().withMessage('Bio is required')
    .isLength({ min: 50, max: 2000 }).withMessage('Bio must be between 50 and 2000 characters'),

  body('location')
    .trim()
    .notEmpty().withMessage('Location is required')
    .isLength({ max: 200 }).withMessage('Location must not exceed 200 characters'),

  body('services')
    .isArray({ min: 1 }).withMessage('At least one service is required')
    .custom((services) => {
      const invalidServices = services.filter(s => !VALID_SERVICES.includes(s));
      if (invalidServices.length > 0) {
        throw new Error(`Invalid services: ${invalidServices.join(', ')}`);
      }
      return true;
    }),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),

  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),

  body('tagline')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Tagline must not exceed 255 characters'),

  body('specializations')
    .optional()
    .isArray().withMessage('Specializations must be an array')
    .custom((specializations) => {
      if (specializations) {
        const invalidSpecs = specializations.filter(s => !VALID_SPECIALIZATIONS.includes(s));
        if (invalidSpecs.length > 0) {
          throw new Error(`Invalid specializations: ${invalidSpecs.join(', ')}`);
        }
      }
      return true;
    }),

  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),

  body('consultationFee')
    .optional()
    .isFloat({ min: 0 }).withMessage('Consultation fee must be a positive number'),

  body('currency')
    .optional()
    .isIn(['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR']).withMessage('Invalid currency'),

  body('photos')
    .optional()
    .isArray().withMessage('Photos must be an array')
    .custom((photos) => {
      if (photos && photos.length > 20) {
        throw new Error('Maximum 20 photos allowed');
      }
      return true;
    }),

  body('yearsExperience')
    .optional()
    .isInt({ min: 0, max: 60 }).withMessage('Years of experience must be between 0 and 60'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),

  body('serviceRadius')
    .optional()
    .isInt({ min: 1, max: 500 }).withMessage('Service radius must be between 1 and 500 km'),

  body('languages')
    .optional()
    .isArray().withMessage('Languages must be an array'),

  body('availableDays')
    .optional()
    .isArray().withMessage('Available days must be an array')
    .custom((days) => {
      if (days) {
        const invalidDays = days.filter(d => !VALID_DAYS.includes(d));
        if (invalidDays.length > 0) {
          throw new Error(`Invalid days: ${invalidDays.join(', ')}`);
        }
      }
      return true;
    }),

  body('availableTimeStart')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),

  body('availableTimeEnd')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),

  handleValidation
];

/**
 * Validate update designer request
 */
const validateDesignerUpdate = [
  body('bio')
    .optional()
    .trim()
    .isLength({ min: 50, max: 2000 }).withMessage('Bio must be between 50 and 2000 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Location must not exceed 200 characters'),

  body('services')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one service is required')
    .custom((services) => {
      if (services) {
        const invalidServices = services.filter(s => !VALID_SERVICES.includes(s));
        if (invalidServices.length > 0) {
          throw new Error(`Invalid services: ${invalidServices.join(', ')}`);
        }
      }
      return true;
    }),

  body('specializations')
    .optional()
    .isArray().withMessage('Specializations must be an array'),

  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),

  body('consultationFee')
    .optional()
    .isFloat({ min: 0 }).withMessage('Consultation fee must be a positive number'),

  body('isAvailable')
    .optional()
    .isBoolean().withMessage('isAvailable must be a boolean'),

  handleValidation
];

/**
 * Validate portfolio item
 */
const validatePortfolio = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 255 }).withMessage('Title must not exceed 255 characters'),

  body('projectType')
    .notEmpty().withMessage('Project type is required')
    .isIn(VALID_PROJECT_TYPES).withMessage('Invalid project type'),

  body('images')
    .isArray({ min: 1 }).withMessage('At least one image is required')
    .custom((images) => {
      if (images && images.length > 20) {
        throw new Error('Maximum 20 images allowed');
      }
      return true;
    }),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),

  body('style')
    .optional()
    .isIn(VALID_SPECIALIZATIONS).withMessage('Invalid style'),

  body('area')
    .optional()
    .isInt({ min: 1 }).withMessage('Area must be a positive integer'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  handleValidation
];

/**
 * Validate booking request
 */
const validateBooking = [
  body('dateTime')
    .notEmpty().withMessage('Date and time is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((dateTime) => {
      const bookingDate = new Date(dateTime);
      const now = new Date();
      if (bookingDate <= now) {
        throw new Error('Booking date must be in the future');
      }
      // Check if booking is at least 24 hours in advance
      const minBookingTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (bookingDate < minBookingTime) {
        throw new Error('Booking must be at least 24 hours in advance');
      }
      return true;
    }),

  body('duration')
    .optional()
    .isInt({ min: 30, max: 480 }).withMessage('Duration must be between 30 and 480 minutes'),

  body('bookingType')
    .optional()
    .isIn(['consultation', 'site_visit', 'design_session']).withMessage('Invalid booking type'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must not exceed 1000 characters'),

  body('meetingType')
    .optional()
    .isIn(['online', 'in_person']).withMessage('Invalid meeting type'),

  body('meetingLocation')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Meeting location must not exceed 500 characters'),

  handleValidation
];

/**
 * Validate review
 */
const validateReview = [
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),

  body('comment')
    .trim()
    .notEmpty().withMessage('Comment is required')
    .isLength({ min: 20, max: 2000 }).withMessage('Comment must be between 20 and 2000 characters'),

  body('communicationRating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Communication rating must be between 1 and 5'),

  body('professionalismRating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Professionalism rating must be between 1 and 5'),

  body('qualityRating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Quality rating must be between 1 and 5'),

  body('valueRating')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Value rating must be between 1 and 5'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Title must not exceed 255 characters'),

  body('photos')
    .optional()
    .isArray().withMessage('Photos must be an array')
    .custom((photos) => {
      if (photos && photos.length > 10) {
        throw new Error('Maximum 10 photos allowed');
      }
      return true;
    }),

  handleValidation
];

module.exports = {
  validateDesigner,
  validateDesignerUpdate,
  validatePortfolio,
  validateBooking,
  validateReview,
  handleValidation,
  VALID_SERVICES,
  VALID_SPECIALIZATIONS,
  VALID_PROJECT_TYPES,
  VALID_DAYS
};