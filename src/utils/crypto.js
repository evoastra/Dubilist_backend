// ===========================================
// CRYPTO UTILITY FUNCTIONS
// ===========================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');

// Generate random bytes as hex string
const generateRandomBytes = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate random token
const generateToken = (length = 64) => {
  return crypto.randomBytes(length).toString('base64url');
};

// Hash a token for storage
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Hash password using bcrypt
const hashPassword = async (password) => {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
};

// Compare password with hash
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Generate OTP
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

// Hash OTP for storage
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

// Generate short code for short links
const generateShortCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// Generate UUID v4
const generateUUID = () => {
  return crypto.randomUUID();
};

// Create HMAC signature
const createHmacSignature = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Verify HMAC signature
const verifyHmacSignature = (data, secret, signature) => {
  const expectedSignature = createHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// Encrypt data (AES-256-GCM)
const encrypt = (text, key) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  };
};

// Decrypt data (AES-256-GCM)
const decrypt = (encryptedData, key) => {
  const { iv, encrypted, authTag } = encryptedData;
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = {
  generateRandomBytes,
  generateToken,
  hashToken,
  hashPassword,
  comparePassword,
  generateOTP,
  hashOTP,
  generateShortCode,
  generateUUID,
  createHmacSignature,
  verifyHmacSignature,
  encrypt,
  decrypt,
};