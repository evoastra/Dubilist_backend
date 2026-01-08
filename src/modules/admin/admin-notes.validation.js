// ===========================================
// ADMIN NOTES VALIDATION
// ===========================================

const Joi = require('joi');

const noteSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Content cannot be empty',
    'string.max': 'Content cannot exceed 2000 characters',
    'any.required': 'Content is required'
  }),
  isInternal: Joi.boolean().default(true)
});

const updateNoteSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Content cannot be empty',
    'string.max': 'Content cannot exceed 2000 characters',
    'any.required': 'Content is required'
  })
});

const getNotesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

const searchNotesQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required().messages({
    'any.required': 'Search query is required'
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

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
  validate,
  noteSchema,
  updateNoteSchema,
  getNotesQuerySchema,
  searchNotesQuerySchema
};