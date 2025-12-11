// ===========================================
// ADMIN NOTES SERVICE
// Feature #73: Admin Notes on Listings
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError, asyncHandler } = require('../../middleware/errorHandler');
const { successResponse, createdResponse, paginatedResponse } = require('../../utils/response');
const { authenticate } = require('../../middleware/authMiddleware');
const { requireModerator } = require('../../middleware/roleMiddleware');
const { validateBody, Joi } = require('../../middleware/validation');

class AdminNoteService {
  // Add note to listing
  async addNote(listingId, adminId, content, isInternal = true) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    const note = await prisma.adminNote.create({
      data: {
        listingId,
        adminId,
        content,
        isInternal,
      },
      include: {
        admin: { select: { id: true, name: true } },
      },
    });

    logger.info({ listingId, noteId: note.id, adminId }, 'Admin note added');

    return note;
  }

  // Get notes for listing
  async getListingNotes(listingId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      prisma.adminNote.findMany({
        where: { listingId },
        include: {
          admin: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminNote.count({ where: { listingId } }),
    ]);

    return {
      data: notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Update note
  async updateNote(noteId, adminId, content) {
    const note = await prisma.adminNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new ApiError(404, 'NOTE_NOT_FOUND', 'Note not found');
    }

    // Only creator can edit
    if (note.adminId !== adminId) {
      throw new ApiError(403, 'FORBIDDEN', 'You can only edit your own notes');
    }

    const updated = await prisma.adminNote.update({
      where: { id: noteId },
      data: { content },
      include: {
        admin: { select: { id: true, name: true } },
      },
    });

    logger.info({ noteId, adminId }, 'Admin note updated');

    return updated;
  }

  // Delete note
  async deleteNote(noteId, adminId, isAdmin = false) {
    const note = await prisma.adminNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new ApiError(404, 'NOTE_NOT_FOUND', 'Note not found');
    }

    // Only creator or admin can delete
    if (!isAdmin && note.adminId !== adminId) {
      throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own notes');
    }

    await prisma.adminNote.delete({
      where: { id: noteId },
    });

    logger.info({ noteId, adminId }, 'Admin note deleted');

    return { message: 'Note deleted' };
  }

  // Search notes across all listings
  async searchNotes(query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where = {
      content: { contains: query, mode: 'insensitive' },
    };

    const [notes, total] = await Promise.all([
      prisma.adminNote.findMany({
        where,
        include: {
          admin: { select: { id: true, name: true } },
          listing: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminNote.count({ where }),
    ]);

    return {
      data: notes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

const adminNoteService = new AdminNoteService();

// Validation schemas
const noteSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  isInternal: Joi.boolean().default(true),
});

const updateNoteSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
});

// All routes require moderator
router.use(authenticate, requireModerator);

// Get notes for listing
router.get(
  '/listings/:listingId',
  asyncHandler(async (req, res) => {
    const result = await adminNoteService.getListingNotes(
      parseInt(req.params.listingId, 10),
      req.query
    );
    paginatedResponse(res, result);
  })
);

// Add note to listing
router.post(
  '/listings/:listingId',
  validateBody(noteSchema),
  asyncHandler(async (req, res) => {
    const note = await adminNoteService.addNote(
      parseInt(req.params.listingId, 10),
      req.user.id,
      req.body.content,
      req.body.isInternal
    );
    createdResponse(res, note, 'Note added');
  })
);

// Update note
router.put(
  '/:noteId',
  validateBody(updateNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await adminNoteService.updateNote(
      parseInt(req.params.noteId, 10),
      req.user.id,
      req.body.content
    );
    successResponse(res, note, 'Note updated');
  })
);

// Delete note
router.delete(
  '/:noteId',
  asyncHandler(async (req, res) => {
    await adminNoteService.deleteNote(
      parseInt(req.params.noteId, 10),
      req.user.id,
      req.user.role === 'admin'
    );
    successResponse(res, null, 'Note deleted');
  })
);

// Search notes
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, ...options } = req.query;
    const result = await adminNoteService.searchNotes(q, options);
    paginatedResponse(res, result);
  })
);

module.exports = router;