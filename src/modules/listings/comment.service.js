// ===========================================
// LISTING COMMENTS SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError } = require('../../middleware/errorHandler');

class CommentService {
  // Add comment to listing
  async addComment(listingId, userId, content, parentCommentId = null) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted || listing.status !== 'approved') {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    // Verify parent comment exists if replying
    if (parentCommentId) {
      const parentComment = await prisma.listingComment.findFirst({
        where: { id: parentCommentId, listingId },
      });

      if (!parentComment) {
        throw new ApiError(404, 'PARENT_COMMENT_NOT_FOUND', 'Parent comment not found');
      }
    }

    const comment = await prisma.listingComment.create({
      data: {
        listingId,
        userId,
        content,
        parentCommentId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    logger.info({ listingId, commentId: comment.id, userId }, 'Comment added');

    return comment;
  }

  // Get comments for listing
  async getComments(listingId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    const where = {
      listingId,
      parentCommentId: null, // Only top-level comments
      status: 'visible',
    };

    const [comments, total] = await Promise.all([
      prisma.listingComment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          replies: {
            where: { status: 'visible' },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.listingComment.count({ where }),
    ]);

    return {
      data: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Update comment
  async updateComment(commentId, userId, content) {
    const comment = await prisma.listingComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this comment');
    }

    const updatedComment = await prisma.listingComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    logger.info({ commentId, userId }, 'Comment updated');

    return updatedComment;
  }

  // Delete comment (soft delete)
  async deleteComment(commentId, userId, isAdmin = false) {
    const comment = await prisma.listingComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    if (!isAdmin && comment.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this comment');
    }

    await prisma.listingComment.update({
      where: { id: commentId },
      data: { status: 'deleted' },
    });

    logger.info({ commentId, userId }, 'Comment deleted');

    return { message: 'Comment deleted' };
  }

  // Hide comment (admin/moderator)
  async hideComment(commentId, moderatorId) {
    const comment = await prisma.listingComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    await prisma.listingComment.update({
      where: { id: commentId },
      data: { status: 'hidden' },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        actorUserId: moderatorId,
        action: 'COMMENT_HIDDEN',
        entityType: 'comment',
        entityId: commentId,
        ipAddress: 'system',
      },
    });

    logger.info({ commentId, moderatorId }, 'Comment hidden');

    return { message: 'Comment hidden' };
  }
}

module.exports = { commentService: new CommentService() };