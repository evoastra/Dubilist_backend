// ===========================================
// ADMIN NOTES CONTROLLER
// ===========================================

const adminNotesService = require('./admin-notes.service');

class AdminNotesController {
  async getListingNotes(req, res) {
    try {
      const listingId = parseInt(req.params.listingId);
      const result = await adminNotesService.getListingNotes(listingId, req.query);

      res.json({
        success: true,
        data: result.notes,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get listing notes error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get notes' }
      });
    }
  }




  
  async addNote(req, res) {
    try {
      const listingId = parseInt(req.params.listingId);
      const { content, isInternal = true } = req.body;

      const note = await adminNotesService.addNote(
        listingId,
        req.user.id,
        content,
        isInternal,
         imagesS3Keys || null
      );

      res.status(201).json({
        success: true,
        message: 'Note added',
        data: note
      });
    } catch (error) {
      console.error('Add note error:', error);
      res.status(error.message === 'Listing not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to add note' }
      });
    }
  }

  async updateNote(req, res) {
    try {
      const noteId = parseInt(req.params.noteId);
      const { content } = req.body;

      const note = await adminNotesService.updateNote(
        noteId,
        req.user.id,
        content
      );

      res.json({
        success: true,
        message: 'Note updated',
        data: note
      });
    } catch (error) {
      console.error('Update note error:', error);
      const statusCode = error.message === 'Note not found' ? 404 :
                         error.message.includes('only edit') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        error: { message: error.message || 'Failed to update note' }
      });
    }
  }

  async deleteNote(req, res) {
    try {
      const noteId = parseInt(req.params.noteId);
      const isAdmin = req.user.role.name === 'admin';

      await adminNotesService.deleteNote(noteId, req.user.id, isAdmin);

      res.json({
        success: true,
        message: 'Note deleted'
      });
    } catch (error) {
      console.error('Delete note error:', error);
      const statusCode = error.message === 'Note not found' ? 404 :
                         error.message.includes('only delete') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        error: { message: error.message || 'Failed to delete note' }
      });
    }
  }

  async searchNotes(req, res) {
    try {
      const { q, ...options } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          error: { message: 'Search query is required' }
        });
      }

      const result = await adminNotesService.searchNotes(q, options);

      res.json({
        success: true,
        data: result.notes,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Search notes error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to search notes' }
      });
    }
  }
}

module.exports = new AdminNotesController();