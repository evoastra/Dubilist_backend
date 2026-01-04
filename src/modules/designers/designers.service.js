// ===========================================
// DESIGNERS MODULE - SERVICE
// File: src/modules/designers/designers.service.js
// ===========================================


const { prisma } = require('../../config/database');
const { calculateDistance } = require('../../utils/geo');

// ===========================================
// CONSTANTS
// ===========================================
console.log('Prisma models:', Object.keys(prisma));
const DESIGNER_SELECT = {
  id: true,
  userId: true,
  bio: true,
  tagline: true,
  location: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  serviceRadius: true,
  services: true,
  specializations: true,
  hourlyRate: true,
  consultationFee: true,
  currency: true,
  photos: true,
  portfolioUrl: true,
  yearsExperience: true,
  certifications: true,
  education: true,
  languages: true,
  availableDays: true,
  availableTimeStart: true,
  availableTimeEnd: true,
  isAvailable: true,
  rating: true,
  totalReviews: true,
  completedProjects: true,
  isVerified: true,
  isFeatured: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      isVerified: true
    }
  }
};

const DESIGNER_LIST_SELECT = {
  id: true,
  userId: true,
  tagline: true,
  location: true,
  city: true,
  services: true,
  specializations: true,
  hourlyRate: true,
  consultationFee: true,
  currency: true,
  photos: true,
  yearsExperience: true,
  isAvailable: true,
  rating: true,
  totalReviews: true,
  completedProjects: true,
  isVerified: true,
  isFeatured: true,
  user: {
    select: {
      id: true,
      name: true,
      avatarUrl: true
    }
  }
};

// ===========================================
// PUBLIC METHODS
// ===========================================

/**
 * Get all designers with filtering and pagination
 */
const getAllDesigners = async ({ page, limit, filters, sortBy, sortOrder }) => {
  const skip = (page - 1) * limit;

  // Build where clause
  const where = {
    isDeleted: false,
    isActive: true
  };

  // Location filter (case-insensitive contains)
  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  if (filters.city) {
    where.city = { contains: filters.city, mode: 'insensitive' };
  }

  if (filters.country) {
    where.country = { contains: filters.country, mode: 'insensitive' };
  }

  // Services filter (JSON array contains)
  if (filters.services && filters.services.length > 0) {
    where.OR = filters.services.map(service => ({
      services: { array_contains: service }
    }));
  }

  // Rating filter
  if (filters.minRating) {
    where.rating = { gte: filters.minRating };
  }

  // Rate filter
  if (filters.minRate !== undefined || filters.maxRate !== undefined) {
    where.hourlyRate = {};
    if (filters.minRate !== undefined) where.hourlyRate.gte = filters.minRate;
    if (filters.maxRate !== undefined) where.hourlyRate.lte = filters.maxRate;
  }

  // Verified filter
  if (filters.isVerified !== undefined) {
    where.isVerified = filters.isVerified;
  }

  // Build orderBy
  let orderBy = {};
  switch (sortBy) {
    case 'rating':
      orderBy = { rating: sortOrder };
      break;
    case 'reviews':
      orderBy = { totalReviews: sortOrder };
      break;
    case 'rate':
      orderBy = { hourlyRate: sortOrder };
      break;
    case 'experience':
      orderBy = { yearsExperience: sortOrder };
      break;
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    default:
      orderBy = [{ isFeatured: 'desc' }, { rating: 'desc' }];
  }

  const [designers, total] = await Promise.all([
    prisma.designer.findMany({
      where,
      select: DESIGNER_LIST_SELECT,
      orderBy,
      skip,
      take: limit
    }),
    prisma.designer.count({ where })
  ]);

  return {
    designers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get designer by ID
 */
const getDesignerById = async (designerId, viewerId = null) => {
  const designer = await prisma.designer.findFirst({
    where: {
      id: designerId,
      isDeleted: false
    },
    select: {
      ...DESIGNER_SELECT,
      _count: {
        select: {
          bookings: true,
          portfolioItems: true,
          reviews: { where: { isApproved: true } }
        }
      }
    }
  });

  return designer;
};

/**
 * Get designer by user ID
 */
const getDesignerByUserId = async (userId) => {
  return prisma.designer.findFirst({
    where: {
      userId,
      isDeleted: false
    },
    select: DESIGNER_SELECT
  });
};

/**
 * Get designer's portfolio
 */
const getDesignerPortfolio = async (designerId, { page, limit, projectType }) => {
  const skip = (page - 1) * limit;

  const where = { designerId };
  if (projectType) {
    where.projectType = projectType;
  }

  const [items, total] = await Promise.all([
    prisma.designerPortfolio.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit
    }),
    prisma.designerPortfolio.count({ where })
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get designer's reviews
 */
const getDesignerReviews = async (designerId, { page, limit, sortBy }) => {
  const skip = (page - 1) * limit;

  const where = {
    designerId,
    isApproved: true,
    isHidden: false
  };

  let orderBy = {};
  switch (sortBy) {
    case 'highest':
      orderBy = { rating: 'desc' };
      break;
    case 'lowest':
      orderBy = { rating: 'asc' };
      break;
    case 'helpful':
      orderBy = { helpfulCount: 'desc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }

  const [reviews, total, stats] = await Promise.all([
    prisma.designerReview.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy,
      skip,
      take: limit
    }),
    prisma.designerReview.count({ where }),
    prisma.designerReview.aggregate({
      where,
      _avg: {
        rating: true,
        communicationRating: true,
        professionalismRating: true,
        qualityRating: true,
        valueRating: true
      },
      _count: { rating: true }
    })
  ]);

  // Calculate rating distribution
  const ratingDistribution = await prisma.designerReview.groupBy({
    by: ['rating'],
    where,
    _count: { rating: true }
  });

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: {
      averageRating: stats._avg.rating || 0,
      averageCommunication: stats._avg.communicationRating || 0,
      averageProfessionalism: stats._avg.professionalismRating || 0,
      averageQuality: stats._avg.qualityRating || 0,
      averageValue: stats._avg.valueRating || 0,
      totalReviews: stats._count.rating,
      distribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = item._count.rating;
        return acc;
      }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
    }
  };
};

/**
 * Get nearby designers
 */
const getNearbyDesigners = async ({ latitude, longitude, radius, page, limit }) => {
  const skip = (page - 1) * limit;

  // Get all active designers with coordinates
  const allDesigners = await prisma.designer.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      ...DESIGNER_LIST_SELECT,
      latitude: true,
      longitude: true
    }
  });

  // Filter by distance
  const nearbyDesigners = allDesigners
    .map(designer => ({
      ...designer,
      distance: calculateDistance(
        latitude,
        longitude,
        parseFloat(designer.latitude),
        parseFloat(designer.longitude)
      )
    }))
    .filter(designer => designer.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  const total = nearbyDesigners.length;
  const paginatedDesigners = nearbyDesigners.slice(skip, skip + limit);

  return {
    designers: paginatedDesigners,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// ===========================================
// CREATE / UPDATE / DELETE METHODS
// ===========================================

/**
 * Create designer profile
 */
const createDesigner = async (data) => {
  return prisma.designer.create({
    data: {
      userId: data.userId,
      bio: data.bio,
      tagline: data.tagline,
      location: data.location,
      city: data.city,
      country: data.country,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      serviceRadius: data.serviceRadius ? parseInt(data.serviceRadius) : null,
      services: data.services || [],
      specializations: data.specializations || [],
      hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
      consultationFee: data.consultationFee ? parseFloat(data.consultationFee) : null,
      currency: data.currency || 'AED',
      photos: data.photos || [],
      portfolioUrl: data.portfolioUrl,
      yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
      certifications: data.certifications || [],
      education: data.education,
      languages: data.languages || [],
      availableDays: data.availableDays || [],
      availableTimeStart: data.availableTimeStart,
      availableTimeEnd: data.availableTimeEnd
    },
    select: DESIGNER_SELECT
  });
};

/**
 * Update designer profile
 */
const updateDesigner = async (designerId, data) => {
  const updateData = {};

  // Map fields with type conversion where needed
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.tagline !== undefined) updateData.tagline = data.tagline;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.country !== undefined) updateData.country = data.country;
  if (data.latitude !== undefined) updateData.latitude = data.latitude ? parseFloat(data.latitude) : null;
  if (data.longitude !== undefined) updateData.longitude = data.longitude ? parseFloat(data.longitude) : null;
  if (data.serviceRadius !== undefined) updateData.serviceRadius = data.serviceRadius ? parseInt(data.serviceRadius) : null;
  if (data.services !== undefined) updateData.services = data.services;
  if (data.specializations !== undefined) updateData.specializations = data.specializations;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate ? parseFloat(data.hourlyRate) : null;
  if (data.consultationFee !== undefined) updateData.consultationFee = data.consultationFee ? parseFloat(data.consultationFee) : null;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.photos !== undefined) updateData.photos = data.photos;
  if (data.portfolioUrl !== undefined) updateData.portfolioUrl = data.portfolioUrl;
  if (data.yearsExperience !== undefined) updateData.yearsExperience = data.yearsExperience ? parseInt(data.yearsExperience) : null;
  if (data.certifications !== undefined) updateData.certifications = data.certifications;
  if (data.education !== undefined) updateData.education = data.education;
  if (data.languages !== undefined) updateData.languages = data.languages;
  if (data.availableDays !== undefined) updateData.availableDays = data.availableDays;
  if (data.availableTimeStart !== undefined) updateData.availableTimeStart = data.availableTimeStart;
  if (data.availableTimeEnd !== undefined) updateData.availableTimeEnd = data.availableTimeEnd;
  if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;

  return prisma.designer.update({
    where: { id: designerId },
    data: updateData,
    select: DESIGNER_SELECT
  });
};

/**
 * Delete designer (soft delete)
 */
const deleteDesigner = async (designerId) => {
  return prisma.designer.update({
    where: { id: designerId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false
    }
  });
};

// ===========================================
// PORTFOLIO METHODS
// ===========================================

/**
 * Add portfolio item
 */
const addPortfolioItem = async (data) => {
  return prisma.designerPortfolio.create({
    data: {
      designerId: data.designerId,
      title: data.title,
      description: data.description,
      projectType: data.projectType,
      style: data.style,
      images: data.images || [],
      beforeImages: data.beforeImages || [],
      afterImages: data.afterImages || [],
      location: data.location,
      area: data.area ? parseInt(data.area) : null,
      budget: data.budget,
      duration: data.duration,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      tags: data.tags || []
    }
  });
};

/**
 * Update portfolio item
 */
const updatePortfolioItem = async (portfolioId, data) => {
  const updateData = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.projectType !== undefined) updateData.projectType = data.projectType;
  if (data.style !== undefined) updateData.style = data.style;
  if (data.images !== undefined) updateData.images = data.images;
  if (data.beforeImages !== undefined) updateData.beforeImages = data.beforeImages;
  if (data.afterImages !== undefined) updateData.afterImages = data.afterImages;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.area !== undefined) updateData.area = data.area ? parseInt(data.area) : null;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;

  return prisma.designerPortfolio.update({
    where: { id: portfolioId },
    data: updateData
  });
};

/**
 * Delete portfolio item
 */
const deletePortfolioItem = async (portfolioId) => {
  return prisma.designerPortfolio.delete({
    where: { id: portfolioId }
  });
};

// ===========================================
// AVAILABILITY METHODS
// ===========================================

/**
 * Get designer availability
 */
const getDesignerAvailability = async (designerId, { startDate, endDate }) => {
  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
    select: {
      availableDays: true,
      availableTimeStart: true,
      availableTimeEnd: true,
      isAvailable: true
    }
  });

  if (!designer) {
    throw new Error('Designer not found');
  }

  // Get existing bookings in the date range
  const whereBookings = {
    designerId,
    status: { in: ['pending', 'confirmed'] }
  };

  if (startDate) {
    whereBookings.dateTime = { gte: new Date(startDate) };
  }
  if (endDate) {
    whereBookings.dateTime = { ...whereBookings.dateTime, lte: new Date(endDate) };
  }

  const bookings = await prisma.designerBooking.findMany({
    where: whereBookings,
    select: {
      dateTime: true,
      duration: true,
      endTime: true
    }
  });

  return {
    settings: {
      availableDays: designer.availableDays,
      availableTimeStart: designer.availableTimeStart,
      availableTimeEnd: designer.availableTimeEnd,
      isAvailable: designer.isAvailable
    },
    bookedSlots: bookings.map(b => ({
      start: b.dateTime,
      end: b.endTime || new Date(b.dateTime.getTime() + b.duration * 60000)
    }))
  };
};

/**
 * Update availability settings
 */
const updateAvailability = async (designerId, data) => {
  return prisma.designer.update({
    where: { id: designerId },
    data: {
      availableDays: data.availableDays,
      availableTimeStart: data.availableTimeStart,
      availableTimeEnd: data.availableTimeEnd,
      isAvailable: data.isAvailable
    },
    select: {
      availableDays: true,
      availableTimeStart: true,
      availableTimeEnd: true,
      isAvailable: true
    }
  });
};

// ===========================================
// ADMIN METHODS
// ===========================================

/**
 * Admin get all designers
 */
const adminGetAllDesigners = async ({ page, limit, isActive, isVerified, search }) => {
  const skip = (page - 1) * limit;

  const where = { isDeleted: false };

  if (isActive !== undefined) where.isActive = isActive;
  if (isVerified !== undefined) where.isVerified = isVerified;
  if (search) {
    where.OR = [
      { location: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const [designers, total] = await Promise.all([
    prisma.designer.findMany({
      where,
      select: {
        ...DESIGNER_SELECT,
        isActive: true,
        createdAt: true,
        _count: {
          select: { bookings: true, reviews: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.designer.count({ where })
  ]);

  return {
    designers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Verify designer
 */
const verifyDesigner = async (designerId, isVerified, adminId) => {
  return prisma.designer.update({
    where: { id: designerId },
    data: {
      isVerified,
      verifiedAt: isVerified ? new Date() : null
    }
  });
};

/**
 * Feature designer
 */
const featureDesigner = async (designerId, { isFeatured, featuredUntil }) => {
  return prisma.designer.update({
    where: { id: designerId },
    data: {
      isFeatured,
      featuredUntil: featuredUntil ? new Date(featuredUntil) : null
    }
  });
};

/**
 * Update designer status
 */
const updateDesignerStatus = async (designerId, isActive) => {
  return prisma.designer.update({
    where: { id: designerId },
    data: { isActive }
  });
};

/**
 * Update designer rating (called after review)
 */
const updateDesignerRating = async (designerId) => {
  const stats = await prisma.designerReview.aggregate({
    where: {
      designerId,
      isApproved: true,
      isHidden: false
    },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.designer.update({
    where: { id: designerId },
    data: {
      rating: stats._avg.rating || 0,
      totalReviews: stats._count.rating
    }
  });
};

module.exports = {
  getAllDesigners,
  getDesignerById,
  getDesignerByUserId,
  getDesignerPortfolio,
  getDesignerReviews,
  getNearbyDesigners,
  createDesigner,
  updateDesigner,
  deleteDesigner,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getDesignerAvailability,
  updateAvailability,
  adminGetAllDesigners,
  verifyDesigner,
  featureDesigner,
  updateDesignerStatus,
  updateDesignerRating
};