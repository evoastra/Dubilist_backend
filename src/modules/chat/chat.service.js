// ===========================================
// CHAT SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError } = require('../../middleware/errorHandler');
const { emailTemplates } = require('../../config/mailer');

class ChatService {
  // Create or get chat room
  async getOrCreateRoom(buyerId, listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { user: true },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    const sellerId = listing.userId;

    // Can't chat with yourself
    if (buyerId === sellerId) {
      throw new ApiError(400, 'INVALID_CHAT', 'Cannot start chat with yourself');
    }

    // Find existing room
    let room = await prisma.chatRoom.findFirst({
      where: {
        listingId,
        buyerId,
        sellerId,
      },
      include: {
        listing: {
          include: {
            images: {
              orderBy: { orderIndex: 'asc' },
              take: 1,
            },
          },
        },
        buyer: { select: { id: true, name: true, avatarUrl: true } },
        seller: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          listingId,
          buyerId,
          sellerId,
        },
        include: {
          listing: {
            include: {
              images: {
                orderBy: { orderIndex: 'asc' },
                take: 1,
              },
            },
          },
          buyer: { select: { id: true, name: true, avatarUrl: true } },
          seller: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      logger.info({ roomId: room.id, buyerId, sellerId, listingId }, 'Chat room created');
    }

    return room;
  }

  // Get user's chat rooms
  async getUserRooms(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      prisma.chatRoom.findMany({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId },
          ],
        },
        include: {
          listing: {
            include: {
              images: {
                orderBy: { orderIndex: 'asc' },
                take: 1,
              },
            },
          },
          buyer: { select: { id: true, name: true, avatarUrl: true } },
          seller: { select: { id: true, name: true, avatarUrl: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                  senderId: { not: userId },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatRoom.count({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId },
          ],
        },
      }),
    ]);

    return {
      data: rooms.map(room => ({
        ...room,
        lastMessage: room.messages[0] || null,
        unreadCount: room._count.messages,
        otherUser: room.buyerId === userId ? room.seller : room.buyer,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get room messages
  async getRoomMessages(roomId, userId, options = {}) {
    const { page = 1, limit = 50, before } = options;
    const skip = (page - 1) * limit;

    // Verify user is part of room
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
    });

    if (!room) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', 'Chat room not found');
    }

    if (room.isBlocked) {
      throw new ApiError(403, 'ROOM_BLOCKED', 'This chat has been blocked');
    }

    const where = {
      roomId,
      isDeleted: false,
    };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatMessage.count({ where }),
    ]);

    // Mark messages as read
    await prisma.chatMessage.updateMany({
      where: {
        roomId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      data: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  // Send message
  async sendMessage(roomId, senderId, content, attachment = null) {
    // Verify sender is part of room
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { buyerId: senderId },
          { sellerId: senderId },
        ],
      },
      include: {
        listing: true,
        buyer: true,
        seller: true,
      },
    });

    if (!room) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', 'Chat room not found');
    }

    if (room.isBlocked) {
      throw new ApiError(403, 'ROOM_BLOCKED', 'This chat has been blocked');
    }

    // Create message
    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        content,
        attachment,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Update room timestamp
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    // Update user's last chat message time
    await prisma.user.update({
      where: { id: senderId },
      data: { lastChatMessageAt: new Date() },
    });

    // Send notification to recipient
    const recipient = room.buyerId === senderId ? room.seller : room.buyer;
    const sender = room.buyerId === senderId ? room.buyer : room.seller;

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        type: 'new_message',
        title: `New message from ${sender.name}`,
        message: content.substring(0, 100),
        data: { roomId, listingId: room.listingId },
      },
    });

    // Send email notification (async)
    emailTemplates.sendChatNotification(recipient, sender.name, room.listing.title).catch(err => {
      logger.error({ err }, 'Failed to send chat notification email');
    });

    logger.info({ roomId, senderId, messageId: message.id }, 'Message sent');

    return message;
  }

  // Delete message
  async deleteMessage(messageId, userId) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found');
    }

    if (message.senderId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own messages');
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    logger.info({ messageId, userId }, 'Message deleted');

    return { message: 'Message deleted' };
  }

  // Block chat room
  async blockRoom(roomId, userId) {
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
    });

    if (!room) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', 'Chat room not found');
    }

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        isBlocked: true,
        blockedBy: userId,
      },
    });

    logger.info({ roomId, userId }, 'Chat room blocked');

    return { message: 'Chat blocked' };
  }

  // Unblock chat room
  async unblockRoom(roomId, userId) {
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        blockedBy: userId,
      },
    });

    if (!room) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', 'Chat room not found or you cannot unblock it');
    }

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        isBlocked: false,
        blockedBy: null,
      },
    });

    logger.info({ roomId, userId }, 'Chat room unblocked');

    return { message: 'Chat unblocked' };
  }

  // Search messages
  async searchMessages(userId, query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Get user's rooms
    const userRooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      select: { id: true },
    });

    const roomIds = userRooms.map(r => r.id);

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          roomId: { in: roomIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          room: {
            include: {
              listing: {
                select: { id: true, title: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatMessage.count({
        where: {
          roomId: { in: roomIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
      }),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = { chatService: new ChatService() };