// ===========================================
// BULK IMPORT SERVICE
// Feature #75: Bulk Listing Upload (CSV)
// ===========================================

const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { ApiError } = require('../../middleware/errorHandler');
const Papa = require('papaparse');

class BulkImportService {
  // Create import batch
  async createImportBatch(userId, fileName, csvContent) {
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (parsed.errors.length > 0) {
      throw new ApiError(400, 'CSV_PARSE_ERROR', 'Failed to parse CSV file');
    }

    const rows = parsed.data;

    if (rows.length === 0) {
      throw new ApiError(400, 'EMPTY_CSV', 'CSV file has no data rows');
    }

    if (rows.length > 500) {
      throw new ApiError(400, 'TOO_MANY_ROWS', 'Maximum 500 rows allowed per import');
    }

    // Create batch
    const batch = await prisma.listingImportBatch.create({
      data: {
        uploadedBy: userId,
        fileName,
        totalRows: rows.length,
        status: 'pending',
      },
    });

    // Create import rows
    const importRows = rows.map((row, index) => ({
      batchId: batch.id,
      rowNumber: index + 1,
      rawData: row,
      status: 'pending',
    }));

    await prisma.listingImportRow.createMany({
      data: importRows,
    });

    logger.info({ batchId: batch.id, rowCount: rows.length }, 'Import batch created');

    // Process asynchronously
    this.processBatch(batch.id, userId).catch(err => {
      logger.error({ err, batchId: batch.id }, 'Batch processing failed');
    });

    return batch;
  }

  // Process batch
  async processBatch(batchId, userId) {
    await prisma.listingImportBatch.update({
      where: { id: batchId },
      data: { status: 'processing' },
    });

    const rows = await prisma.listingImportRow.findMany({
      where: { batchId, status: 'pending' },
      orderBy: { rowNumber: 'asc' },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        const listing = await this.createListingFromRow(row.rawData, userId);

        await prisma.listingImportRow.update({
          where: { id: row.id },
          data: {
            status: 'success',
            listingId: listing.id,
          },
        });

        successCount++;
      } catch (error) {
        await prisma.listingImportRow.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
          },
        });

        errorCount++;
      }
    }

    await prisma.listingImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        successCount,
        errorCount,
        completedAt: new Date(),
      },
    });

    logger.info({ batchId, successCount, errorCount }, 'Import batch completed');

    return { successCount, errorCount };
  }

  // Create listing from row data
  async createListingFromRow(data, userId) {
    // Validate required fields
    const required = ['title', 'description', 'price', 'category_id'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Parse price
    const price = parseFloat(data.price);
    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price value');
    }

    // Verify category
    const category = await prisma.category.findUnique({
      where: { id: parseInt(data.category_id, 10) },
    });

    if (!category) {
      throw new Error(`Invalid category_id: ${data.category_id}`);
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        userId,
        title: data.title.substring(0, 200),
        description: data.description,
        price,
        currency: data.currency || 'AED',
        categoryId: category.id,
        city: data.city,
        country: data.country,
        address: data.address,
        contactPhone: data.contact_phone,
        contactEmail: data.contact_email,
        isNegotiable: data.is_negotiable !== 'false',
        condition: data.condition || 'used',
        status: 'draft', // All imported listings start as draft
      },
    });

    return listing;
  }

  // Get batch status
  async getBatchStatus(batchId, userId) {
    const batch = await prisma.listingImportBatch.findFirst({
      where: { id: batchId, uploadedBy: userId },
      include: {
        rows: {
          select: {
            rowNumber: true,
            status: true,
            errorMessage: true,
            listingId: true,
          },
        },
      },
    });

    if (!batch) {
      throw new ApiError(404, 'BATCH_NOT_FOUND', 'Import batch not found');
    }

    return batch;
  }

  // Get user's import history
  async getImportHistory(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      prisma.listingImportBatch.findMany({
        where: { uploadedBy: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.listingImportBatch.count({ where: { uploadedBy: userId } }),
    ]);

    return {
      data: batches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Get CSV template
  getTemplate() {
    return {
      headers: [
        'title',
        'description',
        'price',
        'currency',
        'category_id',
        'city',
        'country',
        'address',
        'contact_phone',
        'contact_email',
        'is_negotiable',
        'condition',
      ],
      sample: {
        title: 'iPhone 14 Pro Max',
        description: 'Brand new, sealed in box',
        price: '4500',
        currency: 'AED',
        category_id: '1',
        city: 'Dubai',
        country: 'UAE',
        address: 'Downtown Dubai',
        contact_phone: '+971501234567',
        contact_email: 'seller@example.com',
        is_negotiable: 'true',
        condition: 'new',
      },
    };
  }
}

module.exports = { bulkImportService: new BulkImportService() };