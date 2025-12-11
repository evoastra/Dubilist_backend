// ===========================================
// EXPRESS APP - MINIMAL WORKING VERSION
// ===========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security & Parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// INLINE ROUTES (No external file dependencies)
// ============================================

const { prisma } = require('./config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

// Helper: Generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role?.name || 'buyer' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

// Helper: Auth middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: { message: 'Access token required' } });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ success: false, error: { message: 'User not found' } });
    }
    
    req.user = { id: user.id, email: user.email, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
};

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: { message: 'Name, email and password required' } });
    }
    
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Email already exists' } });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        roleId: 4, // buyer
        isVerified: true,
        role: { id: 4, name: 'buyer' }
      }
    });
    
    const tokens = generateTokens(user);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: 'buyer' },
        tokens
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: { message: 'Registration failed' } });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: { message: 'Email and password required' } });
    }
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }
    
    const tokens = generateTokens(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role?.name || 'buyer' },
        tokens
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: { message: 'Login failed' } });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: req.user.role }
  });
});

// ============================================
// USER ROUTES
// ============================================

app.get('/api/users/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: req.user.role }
  });
});

app.put('/api/users/me', authenticate, async (req, res) => {
  const { name, phone, bio } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, phone, bio }
  });
  res.json({ success: true, message: 'Profile updated', data: user });
});

// ============================================
// LISTING ROUTES
// ============================================

// Get all listings
app.get('/api/listings', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'approved', categoryId, city } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = { isDeleted: false };
    if (status) where.status = status;
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (city) where.city = city;
    
    const listings = await prisma.listing.findMany({ where, skip, take: parseInt(limit) });
    const total = await prisma.listing.count({ where });
    
    res.json({
      success: true,
      data: listings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to get listings' } });
  }
});

// Get single listing
app.get('/api/listings/:id', async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!listing) {
      return res.status(404).json({ success: false, error: { message: 'Listing not found' } });
    }
    res.json({ success: true, data: listing });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to get listing' } });
  }
});

// Create listing
app.post('/api/listings', authenticate, async (req, res) => {
  try {
    const { title, description, price, categoryId, city, country, contactPhone } = req.body;
    
    if (!title || !description || !price || !categoryId) {
      return res.status(400).json({ success: false, error: { message: 'Title, description, price and categoryId required' } });
    }
    
    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        categoryId: parseInt(categoryId),
        city,
        country,
        contactPhone,
        userId: req.user.id,
        status: 'draft'
      }
    });
    
    res.status(201).json({ success: true, message: 'Listing created', data: listing });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create listing' } });
  }
});

// Update listing
app.put('/api/listings/:id', authenticate, async (req, res) => {
  try {
    const listing = await prisma.listing.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json({ success: true, message: 'Listing updated', data: listing });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to update listing' } });
  }
});

// Delete listing
app.delete('/api/listings/:id', authenticate, async (req, res) => {
  try {
    await prisma.listing.update({
      where: { id: parseInt(req.params.id) },
      data: { isDeleted: true }
    });
    res.json({ success: true, message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to delete listing' } });
  }
});

// ============================================
// CATEGORY ROUTES
// ============================================

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to get categories' } });
  }
});

// ============================================
// FAVORITES ROUTES
// ============================================

app.get('/api/favorites', authenticate, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({ where: { userId: req.user.id } });
    res.json({ success: true, data: favorites });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to get favorites' } });
  }
});

app.post('/api/favorites/:listingId', authenticate, async (req, res) => {
  try {
    const favorite = await prisma.favorite.create({
      data: { userId: req.user.id, listingId: parseInt(req.params.listingId) }
    });
    res.status(201).json({ success: true, message: 'Added to favorites', data: favorite });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to add favorite' } });
  }
});

app.delete('/api/favorites/:listingId', authenticate, async (req, res) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.id, listingId: parseInt(req.params.listingId) }
    });
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to remove favorite' } });
  }
});

// ============================================
// SEARCH ROUTES
// ============================================

app.get('/api/search', async (req, res) => {
  try {
    const { q, categoryId, city, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = { status: 'approved', isDeleted: false };
    if (q) where.title = { contains: q };
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (city) where.city = city;
    
    const listings = await prisma.listing.findMany({ where, skip, take: parseInt(limit) });
    const total = await prisma.listing.count({ where });
    
    res.json({
      success: true,
      data: listings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Search failed' } });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.role || user.role.name !== 'admin') {
      return res.status(401).json({ success: false, error: { message: 'Invalid admin credentials' } });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }
    
    const tokens = generateTokens(user);
    res.json({ success: true, message: 'Admin login successful', data: { user, tokens } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Admin login failed' } });
  }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Admin access required' } });
    }
    const users = await prisma.user.findMany();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to get users' } });
  }
});

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: `Route ${req.method} ${req.path} not found` } });
});

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: { message: 'Internal server error' } });
});

module.exports = app;