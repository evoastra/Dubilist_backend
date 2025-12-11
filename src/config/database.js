// ===========================================
// DATABASE CONFIGURATION (PRISMA + MOCK)
// ===========================================

const { logger } = require('./logger');

let prisma;

// Check if DATABASE_URL exists and is valid
const dbUrl = process.env.DATABASE_URL;
const useMockDb = !dbUrl || 
                  dbUrl.includes('username:password') || 
                  dbUrl === '' ||
                  process.env.USE_MOCK_DB === 'true';

if (useMockDb) {
  // Use mock database for testing without real DB
  console.log('');
  console.log('⚠️  ==========================================');
  console.log('⚠️  MOCK DATABASE MODE - No real DB required');
  console.log('⚠️  Set DATABASE_URL in .env for real DB');
  console.log('⚠️  ==========================================');
  console.log('');
  
  const mock = require('./mockDatabase');
  prisma = mock.prisma;
} else {
  // Use real Prisma client
  const { PrismaClient } = require('@prisma/client');
  
  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug({
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      }, 'Database Query');
    });
  }

  // Log errors
  prisma.$on('error', (e) => {
    logger.error({ error: e }, 'Database Error');
  });

  // Log warnings
  prisma.$on('warn', (e) => {
    logger.warn({ warning: e }, 'Database Warning');
  });
}

module.exports = { prisma };