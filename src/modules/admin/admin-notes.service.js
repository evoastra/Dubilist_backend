// ===========================================
// ADMIN NOTES SERVICE
// Feature: Admin Notes on Listings
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');

class AdminNotesService {
  /**
   * Add note to listing
   */
  async addNote(listingId, adminId, content, isInternal = true) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new Error('Listing not found');
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

  /**
   * Get notes for listing
   */
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
      notes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update note
   */
  async updateNote(noteId, adminId, content) {
    const note = await prisma.adminNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Only creator can edit
    if (note.adminId !== adminId) {
      throw new Error('You can only edit your own notes');
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

  /**
   * Delete note
   */
  async deleteNote(noteId, adminId, isAdmin = false) {
    const note = await prisma.adminNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    // Only creator or admin can delete
    if (!isAdmin && note.adminId !== adminId) {
      throw new Error('You can only delete your own notes');
    }

    await prisma.adminNote.delete({
      where: { id: noteId },
    });

    logger.info({ noteId, adminId }, 'Admin note deleted');

    return { message: 'Note deleted' };
  }

  /**
   * Search notes across all listings
   */
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
      notes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}

module.exports = new AdminNotesService();