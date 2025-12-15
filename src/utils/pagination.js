// ===========================================
// PAGINATION UTILITY FUNCTIONS
// ===========================================

const { env } = require('../config/env');

// Parse pagination params from request
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    env.MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit, 10) || env.DEFAULT_PAGE_SIZE)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// Create pagination response
const paginateResponse = (data, total, { page, limit }) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
  };
};

// Parse sorting params
const parseSorting = (query, allowedFields = [], defaultSort = 'createdAt', defaultOrder = 'desc') => {
  let sortBy = query.sortBy || query.sort || defaultSort;
  let orderIndex = (query.orderIndex || query.order || defaultOrder).toLowerCase();

  // Validate sort field
  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    sortBy = defaultSort;
  }

  // Validate sort order
  if (!['asc', 'desc'].includes(orderIndex)) {
    orderIndex = defaultOrder;
  }

  return { sortBy, orderIndex };
};

// Create Prisma orderBy object
const createOrderBy = (sortBy, orderIndex) => {
  // Handle nested fields (e.g., 'user.name')
  if (sortBy.includes('.')) {
    const parts = sortBy.split('.');
    let orderBy = { [parts[parts.length - 1]]: orderIndex };
    
    for (let i = parts.length - 2; i >= 0; i--) {
      orderBy = { [parts[i]]: orderBy };
    }
    
    return orderBy;
  }

  return { [sortBy]: orderIndex };
};

// Parse cursor-based pagination
const parseCursor = (query) => {
  const cursor = query.cursor;
  const limit = Math.min(
    env.MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit, 10) || env.DEFAULT_PAGE_SIZE)
  );

  return { cursor, limit };
};

// Create cursor-based pagination response
const cursorPaginateResponse = (data, { limit }) => {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, -1) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return {
    data: items,
    pagination: {
      hasMore,
      nextCursor,
      count: items.length,
    },
  };
};

module.exports = {
  parsePagination,
  paginateResponse,
  parseSorting,
  createOrderBy,
  parseCursor,
  cursorPaginateResponse,
};