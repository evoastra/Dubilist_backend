// ===========================================
// ADMIN NOTES ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const adminNotesController = require('./admin-notes.controller');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireModerator } = require('../../middleware/roleMiddleware');
const { validate, noteSchema, updateNoteSchema, getNotesQuerySchema, searchNotesQuerySchema } = require('./admin-notes.validation');

// All routes require admin or moderator
router.use(authenticate, requireModerator);

/**
 * @route   GET /api/admin-notes/listings/:listingId
 * @desc    Get all notes for a listing
 * @access  Admin, Moderator
 */
router.get(
  '/listings/:listingId',
  validate(getNotesQuerySchema, 'query'),
  adminNotesController.getListingNotes
);

/**
 * @route   POST /api/admin-notes/listings/:listingId
 * @desc    Add note to listing
 * @access  Admin, Moderator
 */
router.post(
  '/listings/:listingId',
  validate(noteSchema),
  adminNotesController.addNote
);

/**
 * @route   PUT /api/admin-notes/:noteId
 * @desc    Update note (only creator)
 * @access  Admin, Moderator
 */
router.put(
  '/:noteId',
  validate(updateNoteSchema),
  adminNotesController.updateNote
);

/**
 * @route   DELETE /api/admin-notes/:noteId
 * @desc    Delete note (creator or admin)
 * @access  Admin, Moderator
 */
router.delete(
  '/:noteId',
  adminNotesController.deleteNote
);

/**
 * @route   GET /api/admin-notes/search
 * @desc    Search notes across all listings
 * @access  Admin, Moderator
 */
router.get(
  '/search',
  validate(searchNotesQuerySchema, 'query'),
  adminNotesController.searchNotes
);

module.exports = router;