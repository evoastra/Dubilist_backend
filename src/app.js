// ===========================================
// EXPRESS APP - DUBILIST MARKETPLACE
// ===========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, connectDatabase } = require('./config/database');

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: { message: 'Access token required' } 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true }
    });

    if (!user || user.isDeleted || user.isBlocked) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid token or user blocked' } 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: { message: 'Invalid or expired token' } 
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role.name !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: { message: 'Admin access required' } 
    });
  }
  next();
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// ===========================================
// HEALTH CHECK
// ===========================================

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// ===========================================
// AUTH ROUTES
// ===========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Name, email and password are required' } 
      });
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: { message: 'Email already registered' } 
      });
    }

    // Get buyer role
    let buyerRole = await prisma.role.findUnique({ where: { name: 'buyer' } });
    if (!buyerRole) {
      buyerRole = await prisma.role.create({ data: { name: 'buyer', description: 'Regular buyer' } });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        roleId: buyerRole.id,
      },
      include: { role: true }
    });

    const tokens = generateTokens(user.id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Registration failed' } 
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Email and password are required' } 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid credentials' } 
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid credentials' } 
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Account is blocked' } 
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Login failed' } 
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role.name,
      isVerified: req.user.isVerified,
      avatarUrl: req.user.avatarUrl,
      bio: req.user.bio,
      createdAt: req.user.createdAt
    }
  });
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Refresh token required' } 
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.isDeleted || user.isBlocked) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid refresh token' } 
      });
    }

    const tokens = generateTokens(user.id);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: { message: 'Invalid refresh token' } 
    });
  }
});

// ===========================================
// USER ROUTES
// ===========================================

// Get profile
app.get('/api/users/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      bio: req.user.bio,
      avatarUrl: req.user.avatarUrl,
      role: req.user.role.name,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt
    }
  });
});

// Update profile
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { name, phone, bio, avatarUrl } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      include: { role: true }
    });

    res.json({
      success: true,
      message: 'Profile updated',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        bio: updated.bio,
        avatarUrl: updated.avatarUrl,
        role: updated.role.name
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update profile' } 
    });
  }
});

// Get user's listings
app.get('/api/users/me/listings', authenticateToken, async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { 
        userId: req.user.id,
        isDeleted: false
      },
      include: {
        category: true,
        images: { take: 1, orderBy: { orderIndex: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get listings' } 
    });
  }
});

// ===========================================
// CATEGORY ROUTES
// ===========================================

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get categories' } 
    });
  }
});

// Get single category
app.get('/api/categories/:id', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { children: true, parent: true }
    });

    if (!category) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Category not found' } 
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get category' } 
    });
  }
});

// ===========================================
// LISTING ROUTES
// ===========================================

// Get all listings
app.get('/api/listings', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'approved',
      categoryId, 
      city, 
      minPrice, 
      maxPrice,
      sort = 'newest'
    } = req.query;

    const where = {
      isDeleted: false,
      ...(status && { status }),
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(city && { city: { contains: city } }),
      ...(minPrice && { price: { gte: parseFloat(minPrice) } }),
      ...(maxPrice && { price: { lte: parseFloat(maxPrice) } }),
    };

    const orderBy = sort === 'price_low' ? { price: 'asc' } :
                    sort === 'price_high' ? { price: 'desc' } :
                    sort === 'oldest' ? { createdAt: 'asc' } :
                    { createdAt: 'desc' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
          images: { take: 1, orderBy: { orderIndex: 'asc' } }
        },
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.listing.count({ where })
    ]);

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get listings' } 
    });
  }
});

// Get single listing
app.get('/api/listings/:id', async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, createdAt: true } },
        category: true,
        images: { orderBy: { orderIndex: 'asc' } }
      }
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    // Increment view count
    await prisma.listing.update({
      where: { id: listing.id },
      data: { viewsCount: { increment: 1 } }
    });

    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get listing' } 
    });
  }
});

// Create listing
app.post('/api/listings', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      categoryId,
      city,
      country,
      address,
      latitude,
      longitude,
      contactPhone,
      contactEmail,
      isNegotiable,
      condition,
      attributes,
      status = 'draft'
    } = req.body;

    if (!title || !description || price === undefined || !categoryId) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Title, description, price and categoryId are required' } 
      });
    }

    // Verify category exists
    const category = await prisma.category.findUnique({ 
      where: { id: parseInt(categoryId) } 
    });
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid category' } 
      });
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        categoryId: parseInt(categoryId),
        userId: req.user.id,
        city,
        country,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        contactPhone: contactPhone || req.user.phone,
        contactEmail: contactEmail || req.user.email,
        isNegotiable: isNegotiable !== false,
        condition,
        attributes: attributes ? JSON.parse(JSON.stringify(attributes)) : null,
        status,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      include: {
        category: true,
        user: { select: { id: true, name: true } }
      }
    });

    // Update user's last listing posted
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastListingPostedAt: new Date() }
    });

    res.status(201).json({
      success: true,
      message: 'Listing created',
      data: listing
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to create listing' } 
    });
  }
});

// Update listing
app.put('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    const listing = await prisma.listing.findUnique({ 
      where: { id: listingId } 
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    // Check ownership (admin can edit any)
    if (listing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Not authorized to edit this listing' } 
      });
    }

    const {
      title,
      description,
      price,
      categoryId,
      city,
      country,
      address,
      contactPhone,
      contactEmail,
      isNegotiable,
      condition,
      attributes,
      status
    } = req.body;

    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(categoryId && { categoryId: parseInt(categoryId) }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
        ...(address !== undefined && { address }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(isNegotiable !== undefined && { isNegotiable }),
        ...(condition !== undefined && { condition }),
        ...(attributes !== undefined && { attributes }),
        ...(status && { status }),
      },
      include: { category: true }
    });

    res.json({
      success: true,
      message: 'Listing updated',
      data: updated
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update listing' } 
    });
  }
});

// Delete listing
app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    const listing = await prisma.listing.findUnique({ 
      where: { id: listingId } 
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    if (listing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Not authorized to delete this listing' } 
      });
    }

    // Soft delete
    await prisma.listing.update({
      where: { id: listingId },
      data: { 
        isDeleted: true, 
        deletedAt: new Date(),
        //status: 'deleted'
      }
    });

    res.json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to delete listing' } 
    });
  }
});

// ===========================================
// LISTING IMAGES
// ===========================================

// Add image to listing
app.post('/api/listings/:id/images', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const { url, s3Key, orderIndex = 0 } = req.body;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    if (listing.userId !== req.user.id && req.user.role.name !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Not authorized' } 
      });
    }

    const image = await prisma.listingImage.create({
      data: {
        listingId,
        url,
        s3Key,
        orderIndex
      }
    });

    res.status(201).json({ success: true, data: image });
  } catch (error) {
    console.error('Add image error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to add image' } 
    });
  }
});

// ===========================================
// FAVORITES ROUTES
// ===========================================

// Get favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        listing: {
          include: {
            images: { take: 1 },
            category: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out deleted listings
    const activeFavorites = favorites.filter(f => !f.listing.isDeleted);

    res.json({ success: true, data: activeFavorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get favorites' } 
    });
  }
});

// Add to favorites
app.post('/api/favorites/:listingId', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: req.user.id,
          listingId
        }
      }
    });

    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: { message: 'Already in favorites' } 
      });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user.id,
        listingId
      }
    });

    // Increment favorites count
    await prisma.listing.update({
      where: { id: listingId },
      data: { favoritesCount: { increment: 1 } }
    });

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: favorite
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to add favorite' } 
    });
  }
});

// Remove from favorites
app.delete('/api/favorites/:listingId', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId: req.user.id,
          listingId
        }
      }
    });

    if (!favorite) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Not in favorites' } 
      });
    }

    await prisma.favorite.delete({
      where: { id: favorite.id }
    });

    // Decrement favorites count
    await prisma.listing.update({
      where: { id: listingId },
      data: { favoritesCount: { decrement: 1 } }
    });

    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to remove favorite' } 
    });
  }
});

// ===========================================
// SEARCH ROUTES
// ===========================================

app.get('/api/search', async (req, res) => {
  try {
    const { 
      q = '', 
      categoryId, 
      city, 
      minPrice, 
      maxPrice,
      condition,
      page = 1, 
      limit = 20 
    } = req.query;

    const where = {
      isDeleted: false,
      status: 'approved',
      OR: q ? [
        { title: { contains: q } },
        { description: { contains: q } }
      ] : undefined,
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(city && { city: { contains: city } }),
      ...(condition && { condition }),
      ...(minPrice && { price: { gte: parseFloat(minPrice) } }),
      ...(maxPrice && { price: { lte: parseFloat(maxPrice) } }),
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          images: { take: 1 },
          user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.listing.count({ where })
    ]);

    // Log search
    await prisma.searchLog.create({
      data: {
        query: q || '',
        filters: { categoryId, city, minPrice, maxPrice },
        resultsCount: total
      }
    }).catch(() => {}); // Ignore errors

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Search failed' } 
    });
  }
});

// ===========================================
// ADMIN ROUTES
// ===========================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user || !user.passwordHash || user.role.name !== 'admin') {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid admin credentials' } 
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Invalid admin credentials' } 
      });
    }

    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Login failed' } 
    });
  }
});

// Get all users (admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isBlocked } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isDeleted: false,
      ...(role && { role: { name: role } }),
      ...(isBlocked !== undefined && { isBlocked: isBlocked === 'true' })
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role.name,
        isVerified: u.isVerified,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get users' } 
    });
  }
});

// Get single user (admin)
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { 
        role: true,
        listings: { take: 5, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'User not found' } 
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get user' } 
    });
  }
});

// Block/unblock user (admin)
app.patch('/api/admin/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isBlocked } = req.body;
    
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isBlocked }
    });

    res.json({
      success: true,
      message: isBlocked ? 'User blocked' : 'User unblocked',
      data: { id: user.id, isBlocked: user.isBlocked }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update user' } 
    });
  }
});

// Get all listings (admin)
app.get('/api/admin/listings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status })
    };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.listing.count({ where })
    ]);

    res.json({
      success: true,
      data: listings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get listings' } 
    });
  }
});

// Approve/reject listing (admin)
app.patch('/api/admin/listings/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, reasonRejected } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid status' } 
      });
    }

    const listing = await prisma.listing.update({
      where: { id: parseInt(req.params.id) },
      data: { 
        status,
        reasonRejected: status === 'rejected' ? reasonRejected : null,
        publishedAt: status === 'approved' ? new Date() : undefined
      }
    });

    res.json({
      success: true,
      message: `Listing ${status}`,
      data: listing
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update listing' } 
    });
  }
});

// Dashboard stats (admin)
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalListings,
      pendingListings,
      activeListings
    ] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.listing.count({ where: { status: 'approved', isDeleted: false } })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        pendingListings,
        activeListings
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get stats' } 
    });
  }
});

// ===========================================
// CHAT ROUTES
// ===========================================

// Get my chat rooms
app.get('/api/chat/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { buyerId: req.user.id },
          { sellerId: req.user.id }
        ]
      },
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true, avatarUrl: true } },
        seller: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get chat rooms' } 
    });
  }
});

// Create/get chat room
app.post('/api/chat/rooms', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.body;

    const listing = await prisma.listing.findUnique({ 
      where: { id: parseInt(listingId) } 
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    if (listing.userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Cannot chat with yourself' } 
      });
    }

    // Check for existing room
    let room = await prisma.chatRoom.findFirst({
      where: {
        listingId: listing.id,
        buyerId: req.user.id,
        sellerId: listing.userId
      }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          listingId: listing.id,
          buyerId: req.user.id,
          sellerId: listing.userId
        }
      });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to create chat room' } 
    });
  }
});

// Get messages in room
app.get('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room || (room.buyerId !== req.user.id && room.sellerId !== req.user.id)) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Room not found' } 
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get messages' } 
    });
  }
});

// Send message
app.post('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Message content required' } 
      });
    }

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room || (room.buyerId !== req.user.id && room.sellerId !== req.user.id)) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Room not found' } 
      });
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: req.user.id,
        content: content.trim()
      },
      include: {
        sender: { select: { id: true, name: true } }
      }
    });

    // Update room timestamp
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to send message' } 
    });
  }
});

// ===========================================
// NOTIFICATIONS
// ===========================================

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get notifications' } 
    });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id
      },
      data: { isRead: true, readAt: new Date() }
    });

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update notification' } 
    });
  }
});

// ===========================================
// 404 & ERROR HANDLERS
// ===========================================

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { message: `Route ${req.method} ${req.path} not found` } 
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: { message: 'Internal server error' } 
  });
});

module.exports = app;