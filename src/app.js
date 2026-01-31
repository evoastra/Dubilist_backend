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
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const multer = require('multer');
  const designersRoutes = require('./modules/designers/designers.routes');
  const bookingsRoutes = require('./modules/bookings/bookings.routes');
 const jobApplicationsRoutes = require('./modules/jobApplications/jobApplications.routes');
 const NodeCache = require('node-cache');
const listingsCache = new NodeCache({ 
  stdTTL: 300,      // 5 minutes cache
  checkperiod: 60,  // Cleanup every minute
  useClones: false  // Better performance
});
  const app = express();

  // AWS S3 Configuration
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const S3_BUCKET = process.env.AWS_S3_BUCKET || 'dubilist-images';

  // Multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // ✅ IMPROVED: More flexible image type checking
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/octet-stream' // Sometimes browsers send this for images
    ];
    
    // Also check file extension
    const allowedExtensions = /\.(jpg|jpeg|png|webp|gif)$/i;
    
    const isValidMimeType = allowedTypes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.test(file.originalname.toLowerCase());
    
    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, GIF allowed.`));
    }
  },
});

  // Generate unique filename for S3
  const generateS3Key = (folder, originalName, userId) => {
    const ext = originalName.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${folder}/${userId}_${timestamp}_${random}.${ext}`;
  };


  // After generateS3Key function, add:

  const CATEGORY = {
    MOTORS: 1,
    JOBS: 2,
    PROPERTY: 3,
    CLASSIFIEDS: 4,
    ELECTRONICS: 5,
    FURNITURE: 6
  };

  const VALID_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'sold', 'expired'];

  const cleanStr = (val, maxLen = 255) => {
    if (!val || typeof val !== 'string') return undefined;
    return val.trim().substring(0, maxLen) || undefined;
  };

  const toInt = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const toFloat = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  };

  const clamp = (val, min, max) => {
    if (val === undefined || val === null) return min;
    return Math.max(min, Math.min(max, val));
  };
  // ===========================================
  // MIDDLEWARE
  // ===========================================

  app.use(helmet());

/* ------------------------------
   BODY PARSERS
------------------------------ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ------------------------------
   LOGGING
------------------------------ */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});
// const allowedOrigins = process.env.CORS_ORIGIN
//   ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
//   : [];

// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow Postman, curl, server-to-server
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, origin); // ✅ IMPORTANT
//     }

//     console.error("CORS BLOCKED:", origin);
//     return callback(new Error("Not allowed by CORS"));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// // Handle preflight
// app.options("*", cors());

// /* ----------------------------------
//    HELMET (AFTER CORS)
// ---------------------------------- */
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
// }));

// /* ----------------------------------
//    BODY PARSERS
// ---------------------------------- */
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// /* ----------------------------------
//    REQUEST LOGGING
// ---------------------------------- */
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
//   next();
// });
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
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h' }
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
  app.post('/api/upload/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'No image file provided' } });
      }

      const folder = req.body.folder || 'listings';
      const s3Key = generateS3Key(folder, req.file.originalname, req.user.id);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(command);

      const imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`;

      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: { url: imageUrl, s3Key: s3Key, size: req.file.size, mimetype: req.file.mimetype }
      });
    } catch (error) {
      console.error('S3 upload error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to upload image' } });
    }
  });

  // Upload multiple images to S3
  app.post('/api/upload/images', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'No image files provided' } });
      }

      const folder = req.body.folder || 'listings';
      const uploadedImages = [];

      for (const file of req.files) {
        const s3Key = generateS3Key(folder, file.originalname, req.user.id);

        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await s3Client.send(command);

        const imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`;
        uploadedImages.push({ url: imageUrl, s3Key: s3Key, size: file.size, mimetype: file.mimetype });
      }

      res.status(201).json({
        success: true,
        message: `${uploadedImages.length} images uploaded successfully`,
        data: uploadedImages
      });
    } catch (error) {
      console.error('S3 upload error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to upload images' } });
    }
  });

  // ===========================================
// UPLOAD RESUME (PDF ONLY)
// ===========================================
app.post('/api/upload/resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'No resume file provided' } 
      });
    }

    // Validate PDF only
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Only PDF files are allowed for resumes' } 
      });
    }

    // Max 5MB
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Resume file too large (max 5MB)' } 
      });
    }

    const folder = 'resumes';
    const s3Key = generateS3Key(folder, req.file.originalname, req.user.id);

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    const resumeUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`;

    res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: { 
        url: resumeUrl, 
        s3Key: s3Key, 
        size: req.file.size, 
        mimetype: req.file.mimetype 
      }
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: { message: 'Failed to upload resume' } 
    });
  }
});
  // Delete image from S3
  app.delete('/api/upload/:s3Key(*)', authenticateToken, async (req, res) => {
    try {
      const s3Key = req.params.s3Key;
    if (!s3Key.startsWith(`listings/${req.user.id}_`) && !s3Key.startsWith(`categories/${req.user.id}_`)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Not allowed to delete this file' }
    });
  }
      const command = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key });
      await s3Client.send(command);

      res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
      console.error('S3 delete error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to delete image' } });
    }
  });

  // Get presigned URL for direct upload
  app.post('/api/upload/presigned-url', authenticateToken, async (req, res) => {
    try {
      const { filename, contentType, folder = 'listings' } = req.body;

      if (!filename || !contentType) {
        return res.status(400).json({ success: false, error: { message: 'Filename and contentType are required' } });
      }

      const s3Key = generateS3Key(folder, filename, req.user.id);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${s3Key}`;

      res.json({ success: true, data: { presignedUrl, s3Key, imageUrl } });
    } catch (error) {
      console.error('Presigned URL error:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to generate presigned URL' } });
    }
  });




  // ============================================================


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

// ✅ ADD THIS CHECK
if (!email || !password) {
  return res.status(400).json({
    success: false,
    message: "Email and password are required"
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
        category: {
          select: { id: true, name: true, slug: true }
        },
        images: {
          take: 1,
          orderBy: { orderIndex: 'asc' }
        },

        // ✅ INCLUDE ALL DETAIL TABLES
        jobDetails: true,
        motorDetails: true,
        propertyDetails: true,
        electronicDetails: true,
        furnitureDetails: true,
        classifiedDetails: true
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
          status: { in: ['draft', 'pending', 'approved', 'rejected', 'sold'] }
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
    const categoryId = toInt(req.query.categoryId);
    
    // Pagination check
    const noPaginationCategories = [CATEGORY.FURNITURE, CATEGORY.CLASSIFIEDS];
    const usePagination = !categoryId || !noPaginationCategories.includes(categoryId);
    const page = usePagination ? clamp(toInt(req.query.page) ?? 1, 1, 100000) : 1;
    const limit = usePagination ? clamp(toInt(req.query.limit) ?? 20, 1, 50) : 2000;

    // Parse filters
    const city = cleanStr(req.query.city, 60);
    const minPrice = toFloat(req.query.minPrice);
    const maxPrice = toFloat(req.query.maxPrice);
    const condition = cleanStr(req.query.condition, 50);
    const brand = cleanStr(req.query.brand, 60);
    const make = cleanStr(req.query.make, 60);
    const year = toInt(req.query.year);

    // Sort validation
    const sort = cleanStr(req.query.sort, 30) ?? 'newest';
    const SORTS = new Set(['newest', 'oldest', 'price_low', 'price_high', 'popular']);
    const safeSort = SORTS.has(sort) ? sort : 'newest';

    // ✅ CACHE KEY
    const cacheKey = JSON.stringify({
      categoryId, city, minPrice, maxPrice, condition, brand, make, year,
      sort: safeSort, page: usePagination ? page : 'all', limit: usePagination ? limit : 'all'
    });

    // ✅ CHECK CACHE
    if (!usePagination || page === 1) {
      const cached = listingsCache.get(cacheKey);
      if (cached) {
        console.log('✅ Cache HIT');
        return res.json(cached);
      }
      console.log('❌ Cache MISS');
    }

    // Build where clause
    const where = {
      isDeleted: false,
      ...(categoryId ? { categoryId } : {}),
      ...(city ? { city: { contains: city } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined ? {
        price: {
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      } : {}),
      ...(req.user?.role?.name === 'admin' ? {} : { status: 'approved' }),
    };

    // Category-specific filters
    if (categoryId === CATEGORY.MOTORS) {
      where.motorDetails = {
        ...(condition ? { condition } : {}),
        ...(make ? { make } : {}),
        ...(year ? { year } : {}),
      };
    }
    if (categoryId === CATEGORY.ELECTRONICS) {
      where.electronicDetails = {
        ...(condition ? { condition } : {}),
        ...(brand ? { brand } : {}),
      };
    }
    if (categoryId === CATEGORY.FURNITURE) {
      where.furnitureDetails = {
        ...(condition ? { condition } : {}),
      };
    }
    if (categoryId === CATEGORY.CLASSIFIEDS) {
      where.classifiedDetails = {
        ...(condition ? { condition } : {}),
        ...(brand ? { brand } : {}),
      };
    }

    // OrderBy
    const orderBy = safeSort === 'price_low' ? { price: 'asc' }
      : safeSort === 'price_high' ? { price: 'desc' }
      : safeSort === 'oldest' ? { createdAt: 'asc' }
      : safeSort === 'popular' ? { viewsCount: 'desc' }
      : { createdAt: 'desc' };

    const skip = (page - 1) * limit;

    // Fetch from database
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
          images: { take: 1, orderBy: { orderIndex: 'asc' } },
          motorDetails: { select: { condition: true, make: true, year: true, images: true } },
          electronicDetails: { select: { condition: true, brand: true, images: true } },
          furnitureDetails: { select: { condition: true, images: true } },
          classifiedDetails: { select: { condition: true, brand: true, images: true } },
          jobDetails: { select: { jobTitle: true, companyName: true, companyLogoUrl: true } },
          propertyDetails: { select: { listingType: true, bedrooms: true, images: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    // ✅✅✅ MERGE IMAGES FROM BOTH SOURCES ✅✅✅
    const enhancedListings = listings.map(listing => {
      let mergedImages = [...listing.images]; // Start with ListingImage table
      
      // Add images from category detail tables (JSON field)
      if (listing.motorDetails?.images && Array.isArray(listing.motorDetails.images)) {
        mergedImages.push(...listing.motorDetails.images.map((url, idx) => ({
          id: `motor-${idx}`,
          imageUrl: url,
          orderIndex: mergedImages.length + idx,
          isPrimary: false
        })));
      }
      
      if (listing.jobDetails?.companyLogoUrl) {
        mergedImages.push({
          id: 'job-logo',
          imageUrl: listing.jobDetails.companyLogoUrl,
          orderIndex: 0,
          isPrimary: true
        });
      }
      
      if (listing.propertyDetails?.images && Array.isArray(listing.propertyDetails.images)) {
        mergedImages.push(...listing.propertyDetails.images.map((url, idx) => ({
          id: `property-${idx}`,
          imageUrl: url,
          orderIndex: mergedImages.length + idx,
          isPrimary: false
        })));
      }
      
      if (listing.classifiedDetails?.images && Array.isArray(listing.classifiedDetails.images)) {
        mergedImages.push(...listing.classifiedDetails.images.map((url, idx) => ({
          id: `classified-${idx}`,
          imageUrl: url,
          orderIndex: mergedImages.length + idx,
          isPrimary: false
        })));
      }
      
      if (listing.electronicDetails?.images && Array.isArray(listing.electronicDetails.images)) {
        mergedImages.push(...listing.electronicDetails.images.map((url, idx) => ({
          id: `electronic-${idx}`,
          imageUrl: url,
          orderIndex: mergedImages.length + idx,
          isPrimary: false
        })));
      }
      
      if (listing.furnitureDetails?.images && Array.isArray(listing.furnitureDetails.images)) {
        mergedImages.push(...listing.furnitureDetails.images.map((url, idx) => ({
          id: `furniture-${idx}`,
          imageUrl: url,
          orderIndex: mergedImages.length + idx,
          isPrimary: false
        })));
      }

      return {
        ...listing,
        images: mergedImages.slice(0, 1) // ✅ Return only first image for list view
      };
    });

    const response = {
      success: true,
      data: enhancedListings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // ✅ CACHE THE RESPONSE
    if (!usePagination || page === 1) {
      listingsCache.set(cacheKey, response);
      console.log('💾 Response cached');
    }

    res.json(response);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get listings' },
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
        images: { orderBy: { orderIndex: 'asc' } },
        motorDetails: true,
        jobDetails: true,
        propertyDetails: true,
        classifiedDetails: true,
        electronicDetails: true,
        furnitureDetails: true
      }
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({ 
        success: false, 
        error: { message: 'Listing not found' } 
      });
    }

    // ✅✅✅ MERGE IMAGES FROM BOTH SOURCES ✅✅✅
    let allImages = [...listing.images];
    
    // Motors images
    if (listing.motorDetails?.images && Array.isArray(listing.motorDetails.images)) {
      allImages.push(...listing.motorDetails.images.map((url, idx) => ({
        id: `motor-${idx}`,
        imageUrl: url,
        s3Key: listing.motorDetails.images_s3_keys?.[idx] || null,
        orderIndex: allImages.length + idx,
        isPrimary: false
      })));
    }
    
    // Job company logo
    if (listing.jobDetails?.companyLogoUrl) {
      allImages.push({
        id: 'job-logo',
        imageUrl: listing.jobDetails.companyLogoUrl,
        s3Key: listing.jobDetails.companyLogoS3Key || null,
        orderIndex: 0,
        isPrimary: true
      });
    }
    
    // Property images
    if (listing.propertyDetails?.images && Array.isArray(listing.propertyDetails.images)) {
      allImages.push(...listing.propertyDetails.images.map((url, idx) => ({
        id: `property-${idx}`,
        imageUrl: url,
        s3Key: listing.propertyDetails.images_s3_keys?.[idx] || null,
        orderIndex: allImages.length + idx,
        isPrimary: false
      })));
    }
    
    // Classified images
    if (listing.classifiedDetails?.images && Array.isArray(listing.classifiedDetails.images)) {
      allImages.push(...listing.classifiedDetails.images.map((url, idx) => ({
        id: `classified-${idx}`,
        imageUrl: url,
        s3Key: listing.classifiedDetails.images_s3_keys?.[idx] || null,
        orderIndex: allImages.length + idx,
        isPrimary: false
      })));
    }
    
    // Electronic images
    if (listing.electronicDetails?.images && Array.isArray(listing.electronicDetails.images)) {
      allImages.push(...listing.electronicDetails.images.map((url, idx) => ({
        id: `electronic-${idx}`,
        imageUrl: url,
        s3Key: listing.electronicDetails.images_s3_keys?.[idx] || null,
        orderIndex: allImages.length + idx,
        isPrimary: false
      })));
    }
    
    // Furniture images
    if (listing.furnitureDetails?.images && Array.isArray(listing.furnitureDetails.images)) {
      allImages.push(...listing.furnitureDetails.images.map((url, idx) => ({
        id: `furniture-${idx}`,
        imageUrl: url,
        s3Key: listing.furnitureDetails.images_s3_keys?.[idx] || null,
        orderIndex: allImages.length + idx,
        isPrimary: false
      })));
    }

    // Increment view count
    await prisma.listing.update({
      where: { id: listing.id },
      data: { viewsCount: { increment: 1 } }
    });

    // Track recently viewed
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

    res.json({ 
      success: true, 
      data: {
        ...listing,
        images: allImages // ✅ Return ALL merged images
      }
    });
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
        contactWhatsapp,
        isNegotiable,
        
        // ===== MOTORS FIELDS =====
        condition,
        make,
        model,
        variant,
        year,
        kilometres,
        hoursUsed,
        transmission,
        fuelType,
        bodyType,
        motorType,
        engineSize,
        cylinders,
        horsepower,
        payloadCapacity,
        seatingCapacity,
        color,
        interiorColor,
        warranty,
        serviceHistory,
        features,
        motorImages,  // NEW: Array of image URLs
        motorImagesS3Keys,  // NEW: Array of S3 keys
        
        // ===== JOBS FIELDS =====
        jobTitle,
        companyName,
        companyLogoUrl,  // NEW: Company logo URL
        companyLogoS3Key,  // NEW: Company logo S3 key
        industry,
        jobType,
        workplaceType,
        experienceMin,
        experienceMax,
        experienceLevel,
        educationRequired,
        salaryMin,
        salaryMax,
        salaryPeriod,
        hideSalary,
        skillsRequired,
        languagesRequired,
        certificationsRequired,
        benefits,
        responsibilities,
        numberOfPositions,
        applicationDeadline,
        applicationEmail,
        applicationUrl,
        
        // ===== PROPERTY FIELDS =====
        listingType,
        propertyType,
        bedrooms,
        bathrooms,
        halls,
        areaSqft,
        plotSizeSqft,
        floorNumber,
        totalFloors,
        buildingAge,
        buildingName,
        furnishing,
        parkingSpaces,
        rentFrequency,
        securityDeposit,
        numberOfCheques,
        amenities,
        nearbyPlaces,
        ownershipType,
        developerName,
        projectName,
        completionDate,
        propertyImages,  // NEW: Array of property image URLs
        propertyImagesS3Keys,  // NEW: Array of S3 keys
        
        // ===== CLASSIFIEDS FIELDS =====
        subCategory,
        brand,
        material,
        size,
        weight,
        lengthCm,
        widthCm,
        heightCm,
        gender,
        ageGroup,
        quantity,
        isHandmade,
        yearOfPurchase,
        classifiedImages,  // NEW: Array of item image URLs
        classifiedImagesS3Keys,  // NEW: Array of S3 keys
        
        // ===== ELECTRONICS FIELDS =====
        modelNumber,
        storage,
        ram,
        processor,
        operatingSystem,
        screenSize,
        resolution,
        displayType,
        capacity,
        energyRating,
        wattage,
        warrantyStatus,
        warrantyExpiry,
        purchaseDate,
        hasOriginalBox,
        hasCharger,
        accessories,
        imeiNumber,
        serialNumber,
        electronicImages,  // NEW: Array of product image URLs
        electronicImagesS3Keys,  // NEW: Array of S3 keys
        
        // ===== FURNITURE FIELDS =====
        style,
        primaryMaterial,
        secondaryMaterial,
        woodType,
        finish,
        bedSize,
        mattressIncluded,
        numberOfDrawers,
        numberOfShelves,
        storageCapacity,
        assemblyRequired,
        deliveryAvailable,
        setOf,
        furnitureImages,  // NEW: Array of furniture image URLs
        furnitureImagesS3Keys,  // NEW: Array of S3 keys
        
        status = 'draft'
      } = req.body;

      // ===== VALIDATION =====
      if (!title || !description || price === undefined || !categoryId) {
        return res.status(400).json({ 
          success: false, 
          error: { message: 'Title, description, price and categoryId are required' } 
        });
      }

      const VALID_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'sold', 'expired'];
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }
        });
      }

      const category = await prisma.category.findUnique({ 
        where: { id: parseInt(categoryId) } 
      });
      if (!category) {
        return res.status(400).json({ 
          success: false, 
          error: { message: 'Invalid category' } 
        });
      }

      // Category-specific validation
      if ([1, 5, 6].includes(parseInt(categoryId)) && !condition) {
        return res.status(400).json({
          success: false,
          error: { message: 'Condition is required for this category' }
        });
      }

      // ===== CREATE LISTING WITH TRANSACTION =====
      const listing = await prisma.$transaction(async (tx) => {
        const baseListing = await tx.listing.create({
          data: {
            title,
            description,
            price: parseFloat(price),
            categoryId: parseInt(categoryId),
            userId: req.user.id,
            city,
            country,
            currency: "AED",
            address,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            contactPhone: contactPhone || req.user.phone,
            contactEmail: contactEmail || req.user.email,
            contactWhatsapp: contactWhatsapp || contactPhone || req.user.phone,
            isNegotiable: isNegotiable !== false,
            status,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });

        // ===== 1. MOTORS CATEGORY =====
        if (categoryId == 1) {
          await tx.motorListing.create({
            data: {
              listingId: baseListing.id,
              make: make || 'Unknown',
              model: model || 'Unknown',
              variant,
              year: year ? parseInt(year) : new Date().getFullYear(),
              kilometres: kilometres ? parseInt(kilometres) : null,
              hoursUsed: hoursUsed ? parseInt(hoursUsed) : null,
              transmission,
              fuelType,
              bodyType,
              motorType,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              engineSize: engineSize ? parseInt(engineSize) : null,
              cylinders: cylinders ? parseInt(cylinders) : null,
              horsepower: horsepower ? parseInt(horsepower) : null,
              payloadCapacity: payloadCapacity ? parseInt(payloadCapacity) : null,
              seatingCapacity: seatingCapacity ? parseInt(seatingCapacity) : null,
              condition,
              color,
              interiorColor,
              warranty,
              serviceHistory: serviceHistory === true || serviceHistory === 'true',
              features: features ? (typeof features === 'string' ? JSON.parse(features) : features) : null,
              // NEW: Add images
              images: motorImages ? (typeof motorImages === 'string' ? JSON.parse(motorImages) : motorImages) : null,
              images_s3_keys: motorImagesS3Keys
  ? (typeof motorImagesS3Keys === 'string'
      ? JSON.parse(motorImagesS3Keys)
      : motorImagesS3Keys)
  : null

            }
          });
        }

        // ===== 2. JOBS CATEGORY =====
        if (categoryId == 2) {
          await tx.jobListing.create({
            data: {
              listingId: baseListing.id,
              jobTitle: jobTitle || title,
              companyName: companyName || 'Company',
              companyLogoUrl,  // NEW: Company logo
              companyLogoS3Key,  // NEW: S3 key
              industry: industry || 'General',
              jobType: jobType || 'Full-time',
              workplaceType,
              experienceMin: experienceMin ? parseInt(experienceMin) : null,
              experienceMax: experienceMax ? parseInt(experienceMax) : null,
              experienceLevel,
              educationRequired,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              salaryMin: salaryMin ? parseFloat(salaryMin) : null,
              salaryMax: salaryMax ? parseFloat(salaryMax) : null,
              salaryPeriod,
              hideSalary: hideSalary === true || hideSalary === 'true',
              skillsRequired: skillsRequired ? (typeof skillsRequired === 'string' ? JSON.parse(skillsRequired) : skillsRequired) : null,
              languagesRequired: languagesRequired ? (typeof languagesRequired === 'string' ? JSON.parse(languagesRequired) : languagesRequired) : null,
              certificationsRequired: certificationsRequired ? (typeof certificationsRequired === 'string' ? JSON.parse(certificationsRequired) : certificationsRequired) : null,
              benefits: benefits ? (typeof benefits === 'string' ? JSON.parse(benefits) : benefits) : null,
              responsibilities: responsibilities ? (typeof responsibilities === 'string' ? JSON.parse(responsibilities) : responsibilities) : null,
              numberOfPositions: numberOfPositions ? parseInt(numberOfPositions) : 1,
              applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
              applicationEmail,
              applicationUrl
            }
          });
        }

        // ===== 3. PROPERTY CATEGORY =====
        if (categoryId == 3) {
          await tx.propertyListing.create({
            data: {
              listingId: baseListing.id,
              listingType: listingType || 'For Sale',
              propertyType: propertyType || 'Apartment',
              bedrooms: bedrooms ? parseInt(bedrooms) : null,
              bathrooms: bathrooms ? parseInt(bathrooms) : null,
              halls: halls ? parseInt(halls) : null,
              areaSqft: areaSqft ? parseFloat(areaSqft) : null,
              plotSizeSqft: plotSizeSqft ? parseFloat(plotSizeSqft) : null,
              floorNumber: floorNumber ? parseInt(floorNumber) : null,
              totalFloors: totalFloors ? parseInt(totalFloors) : null,
              buildingAge: buildingAge ? parseInt(buildingAge) : null,
              buildingName,
              furnishing,
              condition,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              parkingSpaces: parkingSpaces ? parseInt(parkingSpaces) : null,
              rentFrequency,
              securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
              numberOfCheques: numberOfCheques ? parseInt(numberOfCheques) : null,
              amenities: amenities ? (typeof amenities === 'string' ? JSON.parse(amenities) : amenities) : null,
              nearbyPlaces: nearbyPlaces ? (typeof nearbyPlaces === 'string' ? JSON.parse(nearbyPlaces) : nearbyPlaces) : null,
              ownershipType,
              developerName,
              projectName,
              completionDate: completionDate ? new Date(completionDate) : null,
              // NEW: Add images
              images: propertyImages ? (typeof propertyImages === 'string' ? JSON.parse(propertyImages) : propertyImages) : null,
              images_s3_keys: propertyImagesS3Keys
 ? (typeof propertyImagesS3Keys === 'string' ? JSON.parse(propertyImagesS3Keys) : propertyImagesS3Keys) : null
            }
          });
        }

        // ===== 4. CLASSIFIEDS CATEGORY =====
        if (categoryId == 4) {
          await tx.classifiedListing.create({
            data: {
              listingId: baseListing.id,
              subCategory: subCategory || 'Other',
              condition: condition || 'Used',
              brand,
              model,
              material,
              color,
              size,
              weight: weight ? parseFloat(weight) : null,
              lengthCm: lengthCm ? parseFloat(lengthCm) : null,
              widthCm: widthCm ? parseFloat(widthCm) : null,
              heightCm: heightCm ? parseFloat(heightCm) : null,
              gender,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              ageGroup,
              quantity: quantity ? parseInt(quantity) : 1,
              isHandmade: isHandmade === true || isHandmade === 'true',
              yearOfPurchase: yearOfPurchase ? parseInt(yearOfPurchase) : null,
              warranty,
              features: features ? (typeof features === 'string' ? JSON.parse(features) : features) : null,
              // NEW: Add images
              images: classifiedImages ? (typeof classifiedImages === 'string' ? JSON.parse(classifiedImages) : classifiedImages) : null,
              images_s3_keys: classifiedImagesS3Keys
 ? (typeof classifiedImagesS3Keys === 'string' ? JSON.parse(classifiedImagesS3Keys) : classifiedImagesS3Keys) : null
            }
          });
        }

        // ===== 5. ELECTRONICS CATEGORY =====
        if (categoryId == 5) {
          await tx.electronicListing.create({
            data: {
              listingId: baseListing.id,
              subCategory: subCategory || 'Other',
              brand: brand || 'Unknown',
              model: model || 'Unknown',
              modelNumber,
              condition: condition || 'Used',
              storage,
              ram,
              processor,
              operatingSystem,
              screenSize: screenSize ? parseFloat(screenSize) : null,
              resolution,
              displayType,
              capacity,
              energyRating,
              wattage: wattage ? parseInt(wattage) : null,
              color,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              weight: weight ? parseFloat(weight) : null,
              lengthCm: lengthCm ? parseFloat(lengthCm) : null,
              widthCm: widthCm ? parseFloat(widthCm) : null,
              heightCm: heightCm ? parseFloat(heightCm) : null,
              warrantyStatus,
              warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
              purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
              hasOriginalBox: hasOriginalBox === true || hasOriginalBox === 'true',
              hasCharger: hasCharger === true || hasCharger === 'true',
              accessories: accessories ? (typeof accessories === 'string' ? JSON.parse(accessories) : accessories) : null,
              imeiNumber,
              serialNumber,
              features: features ? (typeof features === 'string' ? JSON.parse(features) : features) : null,
              // NEW: Add images
              images: electronicImages ? (typeof electronicImages === 'string' ? JSON.parse(electronicImages) : electronicImages) : null,
              images_s3_keys: electronicImagesS3Keys
 ? (typeof electronicImagesS3Keys === 'string' ? JSON.parse(electronicImagesS3Keys) : electronicImagesS3Keys) : null
            }
          });
        }

        // ===== 6. FURNITURE CATEGORY =====
        if (categoryId == 6) {
          await tx.furnitureListing.create({
            data: {
              listingId: baseListing.id,
              subCategory: subCategory || 'Other',
              condition: condition || 'Used',
              style,
              primaryMaterial,
              secondaryMaterial,
              woodType,
              color,
              finish,
              lengthCm: lengthCm ? parseFloat(lengthCm) : null,
              widthCm: widthCm ? parseFloat(widthCm) : null,
              heightCm: heightCm ? parseFloat(heightCm) : null,
              weight: weight ? parseFloat(weight) : null,
              seatingCapacity: seatingCapacity ? parseInt(seatingCapacity) : null,
              bedSize,
              mattressIncluded: mattressIncluded === true || mattressIncluded === 'true',
              numberOfDrawers: numberOfDrawers ? parseInt(numberOfDrawers) : null,
              numberOfShelves: numberOfShelves ? parseInt(numberOfShelves) : null,
              storageCapacity,
              assemblyRequired: assemblyRequired === true || assemblyRequired === 'true',
              deliveryAvailable: deliveryAvailable === true || deliveryAvailable === 'true',
              brand,
                  price: parseFloat(price), // ✅ ADD THIS
    currency: req.body.currency || 'AED',
              setOf: setOf ? parseInt(setOf) : null,
              features: features ? (typeof features === 'string' ? JSON.parse(features) : features) : null,
              // NEW: Add images
              images: furnitureImages ? (typeof furnitureImages === 'string' ? JSON.parse(furnitureImages) : furnitureImages) : null,
              images_s3_keys: furnitureImagesS3Keys
 ? (typeof furnitureImagesS3Keys === 'string' ? JSON.parse(furnitureImagesS3Keys) : furnitureImagesS3Keys) : null
            }


            
          });
        }

        return baseListing;
      });

      await prisma.user.update({
        where: { id: req.user.id },
        data: { lastListingPostedAt: new Date() }
      });

      res.status(201).json({
        success: true,
        message: 'Listing created successfully',
        data: listing
      });
    } catch (error) {
      console.error('Create listing error:', error);
      res.status(500).json({ 
        success: false, 
        error: { message: 'Failed to create listing', details: error.message } 
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
        make,
        subCategory,
          motorType,         // ADD
    responsibilities,  // ADD
    halls,             // ADD 
        model,
        year,
        status
      } = req.body;
      // 🔁 If category changed, remove old category details
 if (categoryId && parseInt(categoryId) !== listing.categoryId) {
  await prisma.motorListing.deleteMany({ where: { listingId } });
  await prisma.jobListing.deleteMany({ where: { listingId } });
  await prisma.propertyListing.deleteMany({ where: { listingId } });
  await prisma.classifiedListing.deleteMany({ where: { listingId } });
  await prisma.electronicListing.deleteMany({ where: { listingId } });
  await prisma.furnitureListing.deleteMany({ where: { listingId } });
}
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
        
        
          ...(status && { status }),
        },
        include: { category: true }
      });



  // 🔧 Update category-specific condition
  const finalCategoryId = updated.categoryId;

  if (finalCategoryId == 1 && (condition || motorType)) {
    await prisma.motorListing.upsert({
      where: { listingId },
      update: { 
        ...(condition && { condition }),
        ...(motorType && { motorType })  // ADD
      },
      create: { listingId, condition, motorType }
    });
  }
  if (finalCategoryId == 2 && responsibilities) {
    await prisma.jobListing.upsert({
      where: { listingId },
      update: { 
        responsibilities: typeof responsibilities === 'string' 
          ? JSON.parse(responsibilities) 
          : responsibilities
      },
      create: { 
        listingId, 
        jobTitle: 'Job',
        companyName: 'Company',
        industry: 'General',
        jobType: 'Full-time',
        responsibilities: typeof responsibilities === 'string' 
          ? JSON.parse(responsibilities) 
          : responsibilities
      }
    });
  }
  if (finalCategoryId == 3 && halls !== undefined) {
    await prisma.propertyListing.upsert({
      where: { listingId },
      update: { halls: parseInt(halls) },
      create: { 
        listingId, 
        listingType: 'For Sale',
        propertyType: 'Apartment',
        halls: parseInt(halls)
      }
    });
  }
  if (finalCategoryId == 5 && condition) {
    await prisma.electronicListing.upsert({
      where: { listingId },
      update: { condition },
      create: { listingId, condition }
    });
  }

  if (finalCategoryId == 6 && condition) {
    await prisma.furnitureListing.upsert({
      where: { listingId },
      update: { condition },
      create: { listingId, condition }
    });
  }

listingsCache.flushAll();

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
     
  res.json({ 
    success: true, 
    message: 'Listings cache cleared' 
  });
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
listingsCache.flushAll();
      res.json({ success: true, message: 'Listing deleted' });
    } catch (error) {
      console.error('Delete listing error:', error);
      res.status(500).json({ 
        success: false, 
        error: { message: 'Failed to delete listing' } 
      });
    }
     
  res.json({ 
    success: true, 
    message: 'Listings cache cleared' 
  });
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
listingsCache.flushAll();
      res.json({ success: true, message: 'Listing marked as sold' });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: { message: 'Failed to update listing' } 
      });
    }
      
  res.json({ 
    success: true, 
    message: 'Listings cache cleared' 
  });
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

      if (isNaN(listingId) || isNaN(imageId)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid listing ID or image ID' } });
      }

      const listing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing) {
        return res.status(404).json({ success: false, error: { message: 'Listing not found' } });
      }

      if (listing.userId !== req.user.id && req.user.role.name !== 'admin') {
        return res.status(403).json({ success: false, error: { message: 'Not authorized' } });
      }

      // Get image to delete from S3
      const image = await prisma.listingImage.findUnique({ where: { id: imageId } });
      if (image && image.s3Key) {
        try {
          const command = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: image.s3Key });
          await s3Client.send(command);
        } catch (s3Error) {
          console.error('S3 delete error:', s3Error);
        }
      }

      await prisma.listingImage.delete({ where: { id: imageId } });

      res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: 'Failed to delete image' } });
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
app.post('/api/listings/:id/apply', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    // Check if listing exists and is a job
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { 
        jobDetails: true,
        category: true 
      }
    });

    if (!listing || listing.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Job listing not found' }
      });
    }

    if (listing.categoryId !== 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'This is not a job listing' }
      });
    }

    if (listing.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: { message: 'This job is not active' }
      });
    }

    // Can't apply to your own job
    if (listing.userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot apply to your own job listing' }
      });
    }

    // Validate required fields
    const {
      resumeUrl,
      resumeS3Key,
      qualification,
      jobStatus
    } = req.body;

    if (!resumeUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'Resume is required. Please upload your resume first.' }
      });
    }

    if (!jobStatus) {
      return res.status(400).json({
        success: false,
        error: { message: 'Job status (experienced/fresher) is required' }
      });
    }

    // Create application using JobApplication table
    const application = await prisma.jobApplication.create({
      data: {
        listingId: listingId,
        userId: req.user.id,
        name: req.user.name,
        email: req.user.email,
        mobileNo: req.user.phone || req.body.mobileNo,
        resumeUrl,
        resumeS3Key,
        qualification,
        jobStatus,
        status: 'pending'
      }
    });

    // Notify job poster
    await prisma.notification.create({
      data: {
        userId: listing.userId,
        type: 'system',
        title: 'New Job Application',
        message: `${req.user.name} applied for ${listing.title}`,
        data: {
          applicationId: application.id,
          listingId: listing.id
        }
      }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });

  } catch (error) {
    console.error('Job application error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to submit application', details: error.message }
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
        cityMatch = 'contains', // ✅ contains | startsWith | exact
        minPrice,
        maxPrice,

        // ✅ add these
        condition,
        make,
        brand,
        year,

        page = 1,
        limit = 20
      } = req.query;

      const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : null;
      const parsedPage = parseInt(page, 10) || 1;
      const parsedLimit = parseInt(limit, 10) || 20;

      // ✅ FIX: price filter (no overwrite)
      const priceFilter = {};
      if (minPrice !== undefined && minPrice !== '') priceFilter.gte = parseFloat(minPrice);
      if (maxPrice !== undefined && maxPrice !== '') priceFilter.lte = parseFloat(maxPrice);

      // ✅ city filter modes
      let cityFilter;
      if (city) {
        if (cityMatch === 'exact') cityFilter = { equals: city };
        else if (cityMatch === 'startsWith') cityFilter = { startsWith: city };
        else cityFilter = { contains: city };
      }

      // Build where using AND so OR filters don’t break each other
      const andFilters = [];

      // ✅ SAFE: public search only approved
      andFilters.push({ status: 'approved' });
      andFilters.push({ isDeleted: false });

      if (q) {
        andFilters.push({
          OR: [
            { title: { contains: q } },
            { description: { contains: q } }
          ]
        });
      }

      if (parsedCategoryId) andFilters.push({ categoryId: parsedCategoryId });
      if (cityFilter) andFilters.push({ city: cityFilter });
      if (Object.keys(priceFilter).length) andFilters.push({ price: priceFilter });

      // ==========================
      // category detail filters
      // ==========================
      if (parsedCategoryId) {
        // If category chosen, apply filters only to that category detail table
        if (parsedCategoryId === 1) {
          andFilters.push({
            motorDetails: {
              ...(condition ? { condition } : {}),
              ...(make ? { make } : {}),
              ...(year ? { year: parseInt(year, 10) } : {})
            }
          });
        }

        if (parsedCategoryId === 5) {
          andFilters.push({
            electronicDetails: {
              ...(condition ? { condition } : {}),
              ...(brand ? { brand } : {})
            }
          });
        }

        if (parsedCategoryId === 6) {
          andFilters.push({
            furnitureDetails: {
              ...(condition ? { condition } : {})
            }
          });
        }
      } else {
        // If NO categoryId, apply them as OR across known detail tables
        const detailOr = [];

        if (condition) {
          detailOr.push({ motorDetails: { condition } });
          detailOr.push({ electronicDetails: { condition } });
          detailOr.push({ furnitureDetails: { condition } });
        }
        if (make) {
          detailOr.push({ motorDetails: { make } });
        }
        if (year) {
          detailOr.push({ motorDetails: { year: parseInt(year, 10) } });
        }
        if (brand) {
          detailOr.push({ electronicDetails: { brand } });
        }

        if (detailOr.length) andFilters.push({ OR: detailOr });
      }

      const where = { AND: andFilters };

      const skip = (parsedPage - 1) * parsedLimit;

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
          take: parsedLimit
        }),
        prisma.listing.count({ where })
      ]);

      // Log search
      await prisma.searchLog.create({
        data: {
          query: q || '',
          filters: { categoryId, city, cityMatch, minPrice, maxPrice, condition, make, brand, year },
          resultsCount: total
        }
      }).catch(() => {});

      res.json({
        success: true,
        data: listings,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          pages: Math.ceil(total / parsedLimit)
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
// Get my chat rooms - ENHANCED VERSION
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
        listing: { 
          select: { 
            id: true, 
            title: true, 
            price: true,
            status: true,
            images: { take: 1, orderBy: { orderIndex: 'asc' } } 
          } 
        },
        buyer: { 
          select: { 
            id: true, 
            name: true, 
            avatarUrl: true,
            isVerified: true 
          } 
        },
        seller: { 
          select: { 
            id: true, 
            name: true, 
            avatarUrl: true,
            isVerified: true 
          } 
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            senderId: true,
            isRead: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: req.user.id },
                isRead: false
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // ✅ ENHANCE: Add role information for each room
    const enhancedRooms = rooms.map(room => {
      const iAmBuyer = room.buyerId === req.user.id;
      const iAmSeller = room.sellerId === req.user.id;
      
      // Determine the other party (the person I'm chatting with)
      const otherParty = iAmBuyer ? room.seller : room.buyer;
      
      // Get last message info
      const lastMessage = room.messages[0] || null;
      const unreadCount = room._count.messages;
      
      return {
        id: room.id,
        listingId: room.listingId,
        
        // ✅ NEW: My role in this conversation
        myRole: iAmBuyer ? 'buyer' : 'seller',
        
        // ✅ NEW: The person I'm chatting with
        otherParty: {
          id: otherParty.id,
          name: otherParty.name,
          avatarUrl: otherParty.avatarUrl,
          isVerified: otherParty.isVerified,
          role: iAmBuyer ? 'seller' : 'buyer'
        },
        
        // Listing info
        listing: room.listing,
        
        // Last message
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          sentByMe: lastMessage.senderId === req.user.id,
          isRead: lastMessage.isRead,
          createdAt: lastMessage.createdAt
        } : null,
        
        // Unread count
        unreadCount: unreadCount,
        
        // Room status
        isBlocked: room.isBlocked,
        
        // Timestamps
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        
        // ✅ OPTIONAL: Include full buyer/seller info if needed
        buyer: room.buyer,
        seller: room.seller
      };
    });

    res.json({ 
      success: true, 
      data: enhancedRooms,
      total: enhancedRooms.length
    });
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


  // Dashboard stats (admin)
 
  // Get all users (admin)


  // Get single user (admin)
 

  // Block/unblock user (admin)


  // Update user role (admin)

  // Get all listings (admin)




  // Get reports (admin)
 

  // Handle report (admin)


  // Get support tickets (admin)
 

  // Reply to ticket (admin)


  // ===========================================
  // ANALYTICS ROUTES (Admin)
  // ===========================================




  

  // ===========================================
  // FRAUD LOGS (Admin)
  // ===========================================

  



  // ===========================================
  // ROLES (Admin)
  // ===========================================



  // ===========================================
  // CATEGORIES ADMIN
  // ===========================================



  // ===========================================
  // SYSTEM CONFIG (Admin)
  // ===========================================
app.use('/api/admin', require('./modules/admin/admin.routes'));
app.use('/api/admin-notes', require('./modules/admin/admin-notes.routes'));

  app.use('/api/designers', designersRoutes);
  app.use('/api/bookings', bookingsRoutes);
  app.use('/api', jobApplicationsRoutes);
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




  // ===========================================
  // SOCKET.IO SECURE CHAT
  // ===========================================

  const http = require('http');
  const { Server } = require('socket.io');

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
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

