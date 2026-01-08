// ===========================================
// ADMIN CONTROLLER - Request Handlers
// ===========================================

const adminService = require('./admin.service');
const { generateTokenPair } = require('../../utils/token');


class AdminController {
  // ==========================================
  // AUTH
  // ==========================================

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { message: 'Email and password are required' }
        });
      }

      const user = await adminService.login(email, password);
      const tokens = await generateTokenPair(user);


      res.json({
        success: true,
        message: 'Admin login successful',
        data: { user, tokens }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(error.message === 'Invalid admin credentials' ? 401 : 500).json({
        success: false,
        error: { message: error.message || 'Login failed' }
      });
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  async getDashboard(req, res) {
    try {
      const stats = await adminService.getDashboardStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get stats' }
      });
    }
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUsers(req, res) {
    try {
      const result = await adminService.getUsers(req.query);

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get users' }
      });
    }
  }

  async getUserById(req, res) {
    try {
      const user = await adminService.getUserById(parseInt(req.params.id));

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(error.message === 'User not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to get user' }
      });
    }
  }

  async blockUser(req, res) {
    try {
      const { isBlocked } = req.body;
      const result = await adminService.toggleBlockUser(parseInt(req.params.id), isBlocked);

      res.json({
        success: true,
        message: isBlocked ? 'User blocked' : 'User unblocked',
        data: result
      });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update user' }
      });
    }
  }

  async updateUserRole(req, res) {
    try {
      const { roleName } = req.body;

      if (!roleName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role name is required' }
        });
      }

      const result = await adminService.updateUserRole(parseInt(req.params.id), roleName);

      res.json({
        success: true,
        message: 'User role updated',
        data: result
      });
    } catch (error) {
      console.error('Update role error:', error);
      res.status(error.message === 'Invalid role' ? 400 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to update user role' }
      });
    }
  }

  async togglePostingRestriction(req, res) {
    try {
      const { restrict } = req.body;

      const result = await adminService.togglePostingRestriction(
        parseInt(req.params.id),
        req.user.id,
        restrict
      );

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Toggle posting restriction error:', error);
      res.status(error.message === 'User not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to update posting restriction' }
      });
    }
  }

  async impersonateUser(req, res) {
    try {
      const result = await adminService.impersonateUser(
        parseInt(req.params.id),
        req.user.id
      );

      // Generate tokens for impersonation
      const { generateTokens } = require('../../utils/tokens');
      const tokens = generateTokens(result.user.id);

      res.json({
        success: true,
        message: 'Impersonation tokens generated',
        data: { user: result.user, tokens }
      });
    } catch (error) {
      console.error('Impersonate user error:', error);
      res.status(error.message === 'User not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to impersonate user' }
      });
    }
  }

  async getAuditLogs(req, res) {
    try {
      const result = await adminService.getAuditLogs(req.query);

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get audit logs' }
      });
    }
  }

  async suspendListing(req, res) {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { message: 'Reason is required' }
        });
      }

      const result = await adminService.suspendListing(
        parseInt(req.params.id),
        req.user.id,
        reason
      );

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Suspend listing error:', error);
      res.status(error.message === 'Listing not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to suspend listing' }
      });
    }
  }

  // ==========================================
  // LISTING MANAGEMENT
  // ==========================================

  async getListings(req, res) {
    try {
      const result = await adminService.getListings(req.query);

      res.json({
        success: true,
        data: result.listings,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get listings error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get listings' }
      });
    }
  }

  async updateListingStatus(req, res) {
    try {
      const { status, reasonRejected } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: { message: 'Status is required' }
        });
      }

      const listing = await adminService.updateListingStatus(
        parseInt(req.params.id),
        status,
        reasonRejected
      );

      res.json({
        success: true,
        message: `Listing ${status}`,
        data: listing
      });
    } catch (error) {
      console.error('Update listing status error:', error);
      res.status(error.message === 'Invalid status' ? 400 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to update listing' }
      });
    }
  }

  // ==========================================
  // REPORTS
  // ==========================================

  async getReports(req, res) {
    try {
      const reports = await adminService.getReports(req.query);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get reports' }
      });
    }
  }

  async updateReportStatus(req, res) {
    try {
      const { type, id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: { message: 'Status is required' }
        });
      }

      await adminService.updateReportStatus(
        type,
        parseInt(id),
        status,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Report updated'
      });
    } catch (error) {
      console.error('Update report error:', error);
      res.status(error.message.includes('Invalid') ? 400 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to update report' }
      });
    }
  }

  // ==========================================
  // SUPPORT TICKETS
  // ==========================================

  async getSupportTickets(req, res) {
    try {
      const result = await adminService.getSupportTickets(req.query);

      res.json({
        success: true,
        data: result.tickets,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get tickets error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get tickets' }
      });
    }
  }

  async replyToTicket(req, res) {
    try {
      const { message, status } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: { message: 'Message is required' }
        });
      }

      const reply = await adminService.replyToTicket(
        parseInt(req.params.id),
        req.user.id,
        message,
        status
      );

      res.status(201).json({
        success: true,
        message: 'Reply sent',
        data: reply
      });
    } catch (error) {
      console.error('Reply ticket error:', error);
      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to send reply' }
      });
    }
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  async getAnalyticsOverview(req, res) {
    try {
      const { days = 30 } = req.query;
      const stats = await adminService.getAnalyticsOverview(parseInt(days));

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get analytics' }
      });
    }
  }

  async getPopularSearches(req, res) {
    try {
      const { limit = 20 } = req.query;
      const searches = await adminService.getPopularSearches(parseInt(limit));

      res.json({
        success: true,
        data: searches
      });
    } catch (error) {
      console.error('Get popular searches error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get popular searches' }
      });
    }
  }

  async getCategoryStats(req, res) {
    try {
      const stats = await adminService.getCategoryStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get category stats error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get category stats' }
      });
    }
  }

  // ==========================================
  // FRAUD LOGS
  // ==========================================

  async getFraudLogs(req, res) {
    try {
      const result = await adminService.getFraudLogs(req.query);

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get fraud logs error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get fraud logs' }
      });
    }
  }

  async reviewFraudLog(req, res) {
    try {
      await adminService.reviewFraudLog(parseInt(req.params.id));

      res.json({
        success: true,
        message: 'Fraud log marked as reviewed'
      });
    } catch (error) {
      console.error('Review fraud log error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update fraud log' }
      });
    }
  }

  // ==========================================
  // ROLES
  // ==========================================

  async getRoles(req, res) {
    try {
      const roles = await adminService.getRoles();

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get roles' }
      });
    }
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  async createCategory(req, res) {
    try {
      const category = await adminService.createCategory(req.body);

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Create category error:', error);

      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: { message: 'Category slug already exists' }
        });
      }

      res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to create category' }
      });
    }
  }

  async updateCategory(req, res) {
    try {
      const category = await adminService.updateCategory(parseInt(req.params.id), req.body);

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update category' }
      });
    }
  }
async deleteCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.id);

    const result = await adminService.deleteCategory(categoryId);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete category error:', error);
    const statusCode = error.message === 'Category not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: { message: error.message || 'Failed to delete category' }
    });
  }
}
  async updateCategoryImage(req, res) {
    try {
      const categoryId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image file provided' }
        });
      }

      // This will be handled by upload controller
      // Just calling service to update DB
      const { imageUrl, s3Key } = req.uploadedImage;

      const category = await adminService.updateCategoryImage(categoryId, imageUrl, s3Key);

      res.json({
        success: true,
        message: 'Category image updated',
        data: category
      });
    } catch (error) {
      console.error('Upload category image error:', error);
      res.status(error.message === 'Category not found' ? 404 : 500).json({
        success: false,
        error: { message: error.message || 'Failed to upload image' }
      });
    }
  }

  // ==========================================
  // SYSTEM CONFIG
  // ==========================================

  async getSystemConfig(req, res) {
    try {
      const config = await adminService.getSystemConfig();

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Get config error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get config' }
      });
    }
  }

  async updateSystemConfig(req, res) {
    try {
      await adminService.updateSystemConfig(req.body);

      res.json({
        success: true,
        message: 'Config updated'
      });
    } catch (error) {
      console.error('Update config error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update config' }
      });
    }
  }
}

module.exports = new AdminController();