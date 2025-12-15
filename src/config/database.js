// ===========================================
// DATABASE CONFIGURATION - MySQL with Prisma
// ===========================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['error', 'warn']
    : ['error'],
});

async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ MySQL Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('📤 Database disconnected');
}

module.exports = { 
  prisma, 
  connectDatabase, 
  disconnectDatabase 
};