// ===========================================
// LISTING IMAGE SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { env } = require('../../config/env');
const { ApiError } = require('../../middleware/errorHandler');

class ListingImageService {
  // Add image to listing
  async addImage(listingId, userId, imageData) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { images: true },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    if (listing.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this listing');
    }

    // Check image limit
    if (listing.images.length >= env.MAX_IMAGES_PER_LISTING) {
      throw new ApiError(400, 'IMAGE_LIMIT', `Maximum ${env.MAX_IMAGES_PER_LISTING} images allowed`);
    }

    // Get next order index
    const maxOrder = listing.images.reduce((max, img) => Math.max(max, img.orderIndex), -1);
    const orderIndex = maxOrder + 1;

    // Determine if this is the primary image
    const isPrimary = listing.images.length === 0;

    // Create image record
    const image = await prisma.listingImage.create({
      data: {
        listingId,
        imageUrl: imageData.url,
        s3Key: imageData.key,
        orderIndex,
        isPrimary,
      },
    });

    logger.info({ listingId, imageId: image.id }, 'Image added to listing');

    return image;
  }

  // Remove image from listing
  async removeImage(listingId, imageId, userId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    if (listing.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this listing');
    }

    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listingId },
    });

    if (!image) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    }

    // Delete from S3 if key exists
    if (image.s3Key) {
      const { s3Service } = require('../uploads/s3.service');
      await s3Service.deleteFile(image.s3Key).catch(err => {
        logger.error({ err, s3Key: image.s3Key }, 'Failed to delete S3 file');
      });
    }

    // Delete from database
    await prisma.listingImage.delete({
      where: { id: imageId },
    });

    // If deleted image was primary, make next image primary
    if (image.isPrimary) {
      const nextImage = await prisma.listingImage.findFirst({
        where: { listingId },
        orderBy: { orderIndex: 'asc' },
      });

      if (nextImage) {
        await prisma.listingImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }

    logger.info({ listingId, imageId }, 'Image removed from listing');

    return { message: 'Image removed successfully' };
  }

  // Reorder images
  async reorderImages(listingId, userId, imageOrder) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    if (listing.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this listing');
    }

    // Update order for each image
    const updates = imageOrder.map((imageId, index) => 
      prisma.listingImage.update({
        where: { id: imageId },
        data: {
          orderIndex: index,
          isPrimary: index === 0,
        },
      })
    );

    await prisma.$transaction(updates);

    // Get updated images
    const images = await prisma.listingImage.findMany({
      where: { listingId },
      orderBy: { orderIndex: 'asc' },
    });

    logger.info({ listingId }, 'Images reordered');

    return images;
  }

  // Set primary image
  async setPrimaryImage(listingId, imageId, userId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.isDeleted) {
      throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
    }

    if (listing.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this listing');
    }

    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listingId },
    });

    if (!image) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image not found');
    }

    // Reset all images to non-primary
    await prisma.listingImage.updateMany({
      where: { listingId },
      data: { isPrimary: false },
    });

    // Set selected image as primary
    await prisma.listingImage.update({
      where: { id: imageId },
      data: { isPrimary: true, orderIndex: 0 },
    });

    logger.info({ listingId, imageId }, 'Primary image set');

    return { message: 'Primary image updated' };
  }

  // Get listing images
  async getListingImages(listingId) {
    const images = await prisma.listingImage.findMany({
      where: { listingId },
      orderBy: { orderIndex: 'asc' },
    });

    return images;
  }
}

module.exports = { listingImageService: new ListingImageService() };