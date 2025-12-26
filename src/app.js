// ===========================================
// EXPRESS APP - DUBILIST MARKETPLACE (COMPLETE)
// ALL 50+ APIs - Auth, Users, Listings, Chat,
// Reports, Support, Analytics, Fraud, Admin
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

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true }
      });
      if (user && !user.isDeleted && !user.isBlocked) {
        req.user = user;
      }
    } catch (error) {
      // Ignore - optional auth
    }
  }
  next();
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

const requireAdminOrModerator = (req, res, next) => {
  if (req.user.role.name !== 'admin' && req.user.role.name !== 'moderator') {
    return res.status(403).json({ 
      success: false, 
      error: { message: 'Admin or moderator access required' } 
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

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Current and new password required' } 
      });
    }

    const validPassword = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: { message: 'Current password is incorrect' } 
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash }
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to change password' } 
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

// Get public user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid user ID' } 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'User not found' } 
      });
    }

    // Get listing count separately
    const listingCount = await prisma.listing.count({
      where: { userId: userId, isDeleted: false, status: 'approved' }
    });

    res.json({ success: true, data: { ...user, listingCount } });
  } catch (error) {
    console.error('Get public user error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get user' } 
    });
  }
});

// Get user's public listings
app.get('/api/users/:id/listings', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid user ID' } 
      });
    }

    const listings = await prisma.listing.findMany({
      where: { 
        userId: userId,
        isDeleted: false,
        status: 'approved'
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
      where: { isActive: true, parentId: null },
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

// Get category by slug
app.get('/api/categories/slug/:slug', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
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
      condition,
      sort = 'newest'
    } = req.query;

    const where = {
      isDeleted: false,
      ...(status && { status }),
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(city && { city: { contains: city } }),
      ...(condition && { condition }),
      ...(minPrice && { price: { gte: parseFloat(minPrice) } }),
      ...(maxPrice && { price: { lte: parseFloat(maxPrice) } }),
    };

    const orderBy = sort === 'price_low' ? { price: 'asc' } :
                    sort === 'price_high' ? { price: 'desc' } :
                    sort === 'oldest' ? { createdAt: 'asc' } :
                    sort === 'popular' ? { viewsCount: 'desc' } :
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
app.get('/api/listings/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, createdAt: true, isVerified: true } },
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

    // Track recently viewed if user is logged in
    if (req.user) {
      await prisma.recentlyViewed.upsert({
        where: {
          userId_listingId: {
            userId: req.user.id,
            listingId: listing.id
          }
        },
        update: { viewedAt: new Date() },
        create: {
          userId: req.user.id,
          listingId: listing.id
        }
      }).catch(() => {});
    }

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
        deletedAt: new Date()
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

// Mark listing as sold
app.patch('/api/listings/:id/sold', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    if (listing.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'Not authorized' } 
      });
    }

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'sold' }
    });

    res.json({ success: true, message: 'Listing marked as sold' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update listing' } 
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
    
    // Validate listingId
    if (isNaN(listingId)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid listing ID' } 
      });
    }

    const { url, s3Key, orderIndex = 0, isPrimary = false } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Image URL is required' } 
      });
    }

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
        imageUrl: url,
        s3Key,
        orderIndex,
        isPrimary
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

// Delete image from listing
app.delete('/api/listings/:id/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);

    // Validate IDs
    if (isNaN(listingId) || isNaN(imageId)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid listing ID or image ID' } 
      });
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
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

    await prisma.listingImage.delete({ where: { id: imageId } });

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to delete image' } 
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
            images: { take: 1, orderBy: { orderIndex: 'asc' } },
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
// RECENTLY VIEWED ROUTES
// ===========================================

app.get('/api/recently-viewed', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentlyViewed = await prisma.recentlyViewed.findMany({
      where: { userId: req.user.id },
      include: {
        listing: {
          include: {
            images: { take: 1, orderBy: { orderIndex: 'asc' } },
            category: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { viewedAt: 'desc' },
      take: parseInt(limit)
    });

    const activeViewed = recentlyViewed.filter(rv => !rv.listing.isDeleted);

    res.json({ success: true, data: activeViewed });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get recently viewed' } 
    });
  }
});

app.delete('/api/recently-viewed', authenticateToken, async (req, res) => {
  try {
    await prisma.recentlyViewed.deleteMany({
      where: { userId: req.user.id }
    });

    res.json({ success: true, message: 'Recently viewed cleared' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to clear recently viewed' } 
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
          images: { take: 1, orderBy: { orderIndex: 'asc' } },
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
        filters: { categoryId, city, minPrice, maxPrice, condition },
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
// REPORT ROUTES
// ===========================================

// Report a listing
app.post('/api/reports/listing/:listingId', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId);
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Reason is required' } 
      });
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    // Check if already reported
    const existingReport = await prisma.reportedListing.findFirst({
      where: {
        listingId,
        reporterId: req.user.id,
        status: 'pending'
      }
    });

    if (existingReport) {
      return res.status(409).json({ 
        success: false, 
        error: { message: 'You have already reported this listing' } 
      });
    }

    const report = await prisma.reportedListing.create({
      data: {
        listingId,
        reporterId: req.user.id,
        reason,
        details
      }
    });

    res.status(201).json({
      success: true,
      message: 'Listing reported successfully',
      data: report
    });
  } catch (error) {
    console.error('Report listing error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to report listing' } 
    });
  }
});

// Report a user
app.post('/api/reports/user/:userId', authenticateToken, async (req, res) => {
  try {
    const reportedUserId = parseInt(req.params.userId);
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Reason is required' } 
      });
    }

    if (reportedUserId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Cannot report yourself' } 
      });
    }

    const user = await prisma.user.findUnique({ where: { id: reportedUserId } });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'User not found' } 
      });
    }

    const existingReport = await prisma.reportedUser.findFirst({
      where: {
        reportedUserId,
        reporterId: req.user.id,
        status: 'pending'
      }
    });

    if (existingReport) {
      return res.status(409).json({ 
        success: false, 
        error: { message: 'You have already reported this user' } 
      });
    }

    const report = await prisma.reportedUser.create({
      data: {
        reportedUserId,
        reporterId: req.user.id,
        reason,
        details
      }
    });

    res.status(201).json({
      success: true,
      message: 'User reported successfully',
      data: report
    });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to report user' } 
    });
  }
});

// Get my reports
app.get('/api/reports/my', authenticateToken, async (req, res) => {
  try {
    const [listingReports, userReports] = await Promise.all([
      prisma.reportedListing.findMany({
        where: { reporterId: req.user.id },
        include: { listing: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.reportedUser.findMany({
        where: { reporterId: req.user.id },
        include: { reportedUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({
      success: true,
      data: { listingReports, userReports }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get reports' } 
    });
  }
});

// ===========================================
// SUPPORT TICKET ROUTES
// ===========================================

// Create support ticket
app.post('/api/support/tickets', authenticateToken, async (req, res) => {
  try {
    const { subject, message, priority = 'medium' } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Subject and message are required' } 
      });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        subject,
        message,
        priority
      }
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created',
      data: ticket
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to create ticket' } 
    });
  }
});

// Get my tickets
app.get('/api/support/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get tickets' } 
    });
  }
});

// Get single ticket
app.get('/api/support/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id
      },
      include: {
        messages: {
          include: {
            sender: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Ticket not found' } 
      });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get ticket' } 
    });
  }
});

// Reply to ticket
app.post('/api/support/tickets/:id/reply', authenticateToken, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Message is required' } 
      });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { 
        id: ticketId,
        userId: req.user.id
      }
    });

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Ticket not found' } 
      });
    }

    const reply = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId: req.user.id,
        senderType: 'user',
        message
      }
    });

    // Reopen ticket if closed
    if (ticket.status === 'closed') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'open' }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Reply sent',
      data: reply
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to send reply' } 
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
        listing: { select: { id: true, title: true, images: { take: 1 } } },
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

    // Validate listingId
    if (!listingId) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'listingId is required' } 
      });
    }

    const parsedListingId = parseInt(listingId);
    if (isNaN(parsedListingId)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'listingId must be a valid number' } 
      });
    }

    const listing = await prisma.listing.findUnique({ 
      where: { id: parsedListingId } 
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
        listingId: parsedListingId,
        buyerId: req.user.id,
        sellerId: listing.userId
      }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          listingId: parsedListingId,
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
    const { page = 1, limit = 50 } = req.query;

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room || (room.buyerId !== req.user.id && room.sellerId !== req.user.id)) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Room not found' } 
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId, isDeleted: false },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Mark messages as read
    await prisma.chatMessage.updateMany({
      where: {
        roomId,
        senderId: { not: req.user.id },
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
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

    if (room.isBlocked) {
      return res.status(403).json({ 
        success: false, 
        error: { message: 'This chat is blocked' } 
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

    // Update user's last chat message time
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastChatMessageAt: new Date() }
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

// Get unread count
app.get('/api/chat/unread', authenticateToken, async (req, res) => {
  try {
    const count = await prisma.chatMessage.count({
      where: {
        room: {
          OR: [
            { buyerId: req.user.id },
            { sellerId: req.user.id }
          ]
        },
        senderId: { not: req.user.id },
        isRead: false
      }
    });

    res.json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get unread count' } 
    });
  }
});

// ===========================================
// NOTIFICATIONS
// ===========================================

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
    ]);

    res.json({ 
      success: true, 
      data: notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get notifications' } 
    });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
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

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { 
        userId: req.user.id,
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update notifications' } 
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

// Dashboard stats (admin)
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalListings,
      pendingListings,
      activeListings,
      todayUsers,
      todayListings,
      totalReports,
      pendingReports
    ] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.listing.count({ where: { isDeleted: false } }),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.listing.count({ where: { status: 'approved', isDeleted: false } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.listing.count({ where: { createdAt: { gte: today } } }),
      prisma.reportedListing.count(),
      prisma.reportedListing.count({ where: { status: 'pending' } })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        pendingListings,
        activeListings,
        todayUsers,
        todayListings,
        totalReports,
        pendingReports
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get stats' } 
    });
  }
});

// Get all users (admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isBlocked, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isDeleted: false,
      ...(role && { role: { name: role } }),
      ...(isBlocked !== undefined && { isBlocked: isBlocked === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      })
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
        listings: { 
          take: 10, 
          orderBy: { createdAt: 'desc' },
          include: { category: true }
        },
        _count: {
          select: { 
            listings: true, 
            favorites: true,
            reportsAgainstMe: true
          }
        }
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

// Update user role (admin)
app.patch('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { roleName } = req.body;
    
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid role' } 
      });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { roleId: role.id },
      include: { role: true }
    });

    res.json({
      success: true,
      message: 'User role updated',
      data: { id: user.id, role: user.role.name }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update user role' } 
    });
  }
});

// Get all listings (admin)
app.get('/api/admin/listings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } }
        ]
      })
    };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          images: { take: 1 }
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
      },
      include: { user: true }
    });

    // Create notification for user
    const notificationType = status === 'approved' ? 'listing_approved' : 'listing_rejected';
    await prisma.notification.create({
      data: {
        userId: listing.userId,
        type: notificationType,
        title: status === 'approved' ? 'Listing Approved' : 'Listing Rejected',
        message: status === 'approved' 
          ? `Your listing "${listing.title}" has been approved and is now live.`
          : `Your listing "${listing.title}" has been rejected. Reason: ${reasonRejected || 'Not specified'}`,
        data: { listingId: listing.id }
      }
    }).catch(() => {});

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

// Get reports (admin)
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type = 'all', status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let listingReports = [];
    let userReports = [];

    if (type === 'all' || type === 'listing') {
      listingReports = await prisma.reportedListing.findMany({
        where: status !== 'all' ? { status } : {},
        include: {
          listing: { select: { id: true, title: true } },
          reporter: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'listing' ? skip : 0,
        take: type === 'listing' ? parseInt(limit) : 10
      });
    }

    if (type === 'all' || type === 'user') {
      userReports = await prisma.reportedUser.findMany({
        where: status !== 'all' ? { status } : {},
        include: {
          reportedUser: { select: { id: true, name: true, email: true } },
          reporter: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: type === 'user' ? skip : 0,
        take: type === 'user' ? parseInt(limit) : 10
      });
    }

    res.json({
      success: true,
      data: { listingReports, userReports }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get reports' } 
    });
  }
});

// Handle report (admin)
app.patch('/api/admin/reports/:type/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'dismissed', 'actioned'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid status' } 
      });
    }

    if (type === 'listing') {
      await prisma.reportedListing.update({
        where: { id: parseInt(id) },
        data: { 
          status,
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      });
    } else if (type === 'user') {
      await prisma.reportedUser.update({
        where: { id: parseInt(id) },
        data: { 
          status,
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      });
    }

    res.json({ success: true, message: 'Report updated' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update report' } 
    });
  }
});

// Get support tickets (admin)
app.get('/api/admin/support/tickets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(priority && { priority })
    };

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.supportTicket.count({ where })
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get tickets' } 
    });
  }
});

// Reply to ticket (admin)
app.post('/api/admin/support/tickets/:id/reply', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { message, status } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Message is required' } 
      });
    }

    const reply = await prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId: req.user.id,
        senderType: 'admin',
        message
      }
    });

    // Update ticket status if provided
    if (status) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Reply sent',
      data: reply
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to send reply' } 
    });
  }
});

// ===========================================
// ANALYTICS ROUTES (Admin)
// ===========================================

app.get('/api/admin/analytics/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      newUsers,
      newListings,
      totalViews,
      totalSearches
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.listing.count({ where: { createdAt: { gte: startDate } } }),
      prisma.listing.aggregate({ _sum: { viewsCount: true } }),
      prisma.searchLog.count({ where: { createdAt: { gte: startDate } } })
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        newUsers,
        newListings,
        totalViews: totalViews._sum.viewsCount || 0,
        totalSearches
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get analytics' } 
    });
  }
});

app.get('/api/admin/analytics/popular-searches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const searches = await prisma.searchLog.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: parseInt(limit),
      where: { query: { not: '' } }
    });

    res.json({
      success: true,
      data: searches.map(s => ({
        query: s.query,
        count: s._count.query
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get popular searches' } 
    });
  }
});

app.get('/api/admin/analytics/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        _count: {
          select: { listings: { where: { isDeleted: false } } }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    res.json({
      success: true,
      data: categories.map(c => ({
        id: c.id,
        name: c.name,
        listingCount: c._count.listings
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get category stats' } 
    });
  }
});

// ===========================================
// FRAUD LOGS (Admin)
// ===========================================

app.get('/api/admin/fraud-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, isReviewed } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(isReviewed !== undefined && { isReviewed: isReviewed === 'true' })
    };

    const [logs, total] = await Promise.all([
      prisma.fraudLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.fraudLog.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get fraud logs' } 
    });
  }
});

app.patch('/api/admin/fraud-logs/:id/review', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.fraudLog.update({
      where: { id: parseInt(req.params.id) },
      data: { isReviewed: true }
    });

    res.json({ success: true, message: 'Fraud log marked as reviewed' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update fraud log' } 
    });
  }
});

// ===========================================
// ROLES (Admin)
// ===========================================

app.get('/api/admin/roles', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true } }
      }
    });

    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get roles' } 
    });
  }
});

// ===========================================
// CATEGORIES ADMIN
// ===========================================

app.post('/api/admin/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, parentId, orderIndex = 0 } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Name and slug are required' } 
      });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        parentId: parentId ? parseInt(parentId) : null,
        orderIndex
      }
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false, 
        error: { message: 'Category slug already exists' } 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to create category' } 
    });
  }
});

app.put('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, parentId, orderIndex, isActive } = req.body;

    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId: parentId ? parseInt(parentId) : null }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update category' } 
    });
  }
});

// ===========================================
// SYSTEM CONFIG (Admin)
// ===========================================

app.get('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    
    const configMap = {};
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    res.json({ success: true, data: configMap });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to get config' } 
    });
  }
});

app.put('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body; // { key1: value1, key2: value2 }

    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }

    res.json({ success: true, message: 'Config updated' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to update config' } 
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

// ===========================================
// SOCKET.IO SECURE CHAT
// ===========================================

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Connected users map
const connectedUsers = new Map();

// ===========================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ===========================================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, isBlocked: true, isDeleted: true }
    });

    if (!user || user.isBlocked || user.isDeleted) {
      return next(new Error('User not found or blocked'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Invalid token'));
  }
});

// ===========================================
// MESSAGE VALIDATION (No images, No vulgar)
// ===========================================

const validateMessage = (content) => {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content required' };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 1000) {
    return { valid: false, error: 'Message too long (max 1000 characters)' };
  }

  // Block image/file URLs
  const blockedPatterns = [
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i,
    /\.(mp4|avi|mov|wmv|flv|webm|mkv)(\?.*)?$/i,
    /\.(mp3|wav|ogg|flac|aac)(\?.*)?$/i,
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)(\?.*)?$/i,
    /data:image\//i,
    /blob:/i,
    /(imgur|imgbb|postimg|tinypic|photobucket)\./i
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Images and files are not allowed' };
    }
  }

  // Block vulgar words
  const vulgarWords = [
    'fuck', 'shit', 'ass', 'bitch', 'bastard', 'dick', 'pussy', 
    'cock', 'cunt', 'whore', 'slut', 'nigger', 'faggot', 'damn'
  ];

  const lowerContent = trimmed.toLowerCase();
  for (const word of vulgarWords) {
    if (lowerContent.includes(word)) {
      return { valid: false, error: 'Inappropriate language not allowed' };
    }
  }

  // Sanitize HTML
  const sanitized = trimmed
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return { valid: true, content: sanitized };
};

// ===========================================
// SOCKET CONNECTION HANDLER
// ===========================================

io.on('connection', (socket) => {
  const userId = socket.user.id;
  const userName = socket.user.name;

  console.log(`✅ User connected: ${userName} (ID: ${userId})`);
  connectedUsers.set(userId, socket.id);

  socket.emit('connected', { message: 'Connected to chat server', userId });

  // JOIN ROOM
  socket.on('join_room', async (data) => {
    try {
      const { roomId } = data;
      if (!roomId) return socket.emit('error', { message: 'Room ID required' });

      const room = await prisma.chatRoom.findUnique({
        where: { id: parseInt(roomId) },
        include: { listing: { select: { id: true, title: true } } }
      });

      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.buyerId !== userId && room.sellerId !== userId) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      if (room.isBlocked) return socket.emit('error', { message: 'Chat is blocked' });

      socket.join(`room_${roomId}`);
      console.log(`👤 ${userName} joined room ${roomId}`);
      socket.emit('joined_room', { roomId, listing: room.listing });
      socket.to(`room_${roomId}`).emit('user_joined', { userId, userName });
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // SEND MESSAGE
  socket.on('send_message', async (data) => {
    try {
      const { roomId, content } = data;
      if (!roomId) return socket.emit('error', { message: 'Room ID required' });

      const validation = validateMessage(content);
      if (!validation.valid) return socket.emit('error', { message: validation.error });

      const room = await prisma.chatRoom.findUnique({ where: { id: parseInt(roomId) } });
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.buyerId !== userId && room.sellerId !== userId) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      if (room.isBlocked) return socket.emit('error', { message: 'Chat is blocked' });

      const message = await prisma.chatMessage.create({
        data: {
          roomId: parseInt(roomId),
          senderId: userId,
          content: validation.content
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } }
      });

      await prisma.chatRoom.update({
        where: { id: parseInt(roomId) },
        data: { updatedAt: new Date() }
      });

      await prisma.user.update({
        where: { id: userId },
        data: { lastChatMessageAt: new Date() }
      });

      io.to(`room_${roomId}`).emit('new_message', {
        id: message.id,
        roomId,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt
      });

      console.log(`💬 Room ${roomId}: ${validation.content.substring(0, 30)}...`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // TYPING INDICATORS
  socket.on('typing_start', (data) => {
    if (data.roomId) {
      socket.to(`room_${data.roomId}`).emit('user_typing', { userId, userName });
    }
  });

  socket.on('typing_stop', (data) => {
    if (data.roomId) {
      socket.to(`room_${data.roomId}`).emit('user_stopped_typing', { userId });
    }
  });

  // MARK AS READ
  socket.on('mark_read', async (data) => {
    try {
      if (!data.roomId) return;
      await prisma.chatMessage.updateMany({
        where: { roomId: parseInt(data.roomId), senderId: { not: userId }, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });
      socket.to(`room_${data.roomId}`).emit('messages_read', { roomId: data.roomId, readBy: userId });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  // LEAVE ROOM
  socket.on('leave_room', (data) => {
    if (data.roomId) {
      socket.leave(`room_${data.roomId}`);
      socket.to(`room_${data.roomId}`).emit('user_left', { userId, userName });
      console.log(`👤 ${userName} left room ${data.roomId}`);
    }
  });

  // DISCONNECT
  socket.on('disconnect', (reason) => {
    connectedUsers.delete(userId);
    console.log(`❌ Disconnected: ${userName} (${reason})`);
  });
});

// Export server with socket
module.exports = { app, server, io };