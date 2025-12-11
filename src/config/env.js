
    // ===========================================
// ENVIRONMENT CONFIGURATION
// ===========================================

require('dotenv').config();

const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  API_PREFIX: process.env.API_PREFIX || '/api',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  // Bcrypt
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // AWS S3
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  AWS_S3_PRESIGNED_EXPIRY: parseInt(process.env.AWS_S3_PRESIGNED_EXPIRY, 10) || 3600,

  // Email/SMTP
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@marketplace.com',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Marketplace',

  // SMS/OTP
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'twilio',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  SMS_API_SECRET: process.env.SMS_API_SECRET || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || 'MARKETPLACE',
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH, 10) || 6,
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  OTP_COOLDOWN_MINUTES: parseInt(process.env.OTP_COOLDOWN_MINUTES, 10) || 1,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  CHAT_RATE_LIMIT_MAX: parseInt(process.env.CHAT_RATE_LIMIT_MAX, 10) || 10,

  // Listing Configuration
  LISTING_EXPIRY_DAYS: parseInt(process.env.LISTING_EXPIRY_DAYS, 10) || 30,
  LISTING_BOOST_HOURS: parseInt(process.env.LISTING_BOOST_HOURS, 10) || 24,
  MAX_IMAGES_PER_LISTING: parseInt(process.env.MAX_IMAGES_PER_LISTING, 10) || 10,
  MAX_IMAGE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) || 5,

  // Fraud Detection
  FRAUD_MAX_LISTINGS_PER_HOUR: parseInt(process.env.FRAUD_MAX_LISTINGS_PER_HOUR, 10) || 10,
  FRAUD_MAX_DEVICES_PER_DAY: parseInt(process.env.FRAUD_MAX_DEVICES_PER_DAY, 10) || 5,
  FRAUD_MAX_REJECTIONS_COUNT: parseInt(process.env.FRAUD_MAX_REJECTIONS_COUNT, 10) || 3,
  FRAUD_RISK_THRESHOLD: parseInt(process.env.FRAUD_RISK_THRESHOLD, 10) || 70,

  // Search
  SEARCH_RESULTS_LIMIT: parseInt(process.env.SEARCH_RESULTS_LIMIT, 10) || 20,
  SEARCH_CACHE_TTL: parseInt(process.env.SEARCH_CACHE_TTL, 10) || 300,

  // Pagination
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 20,
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE, 10) || 100,

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',

  // Admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@marketplace.com',

  // Maintenance
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_PRETTY: process.env.LOG_PRETTY === 'true',
};

// Validation
const validateEnv = () => {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0 && env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

validateEnv();

module.exports = { env };