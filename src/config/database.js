// ===========================================================================
// DATABASE CONFIGURATION - MySQL with Prisma (Production Grade)
// ===========================================================================

const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

// ─────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const prismaConfig = {
  // Enhanced logging with Pino integration
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
    ...(isDevelopment
      ? [
          {
            emit: 'event',
            level: 'info',
          },
        ]
      : []),
  ],

  // Connection pool configuration for optimal performance
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },

  // Error formatting
  errorFormat: isDevelopment ? 'pretty' : 'minimal',
};

// ─────────────────────────────────────────────────────────────────────────
// Prisma Client Instance with Singleton Pattern
// ─────────────────────────────────────────────────────────────────────────

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient(prismaConfig);

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

// ─────────────────────────────────────────────────────────────────────────
// Event Listeners for Enhanced Logging
// ─────────────────────────────────────────────────────────────────────────

// Log slow queries (production monitoring)
prisma.$on('query', (e) => {
  const duration = e.duration;
  const slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000;

  if (duration > slowQueryThreshold) {
    logger.warn(
      {
        query: e.query,
        params: e.params,
        duration: `${duration}ms`,
        target: e.target,
      },
      `Slow query detected: ${duration}ms`
    );
  } else if (isDevelopment) {
    logger.debug(
      {
        query: e.query,
        duration: `${duration}ms`,
      },
      'Query executed'
    );
  }
});

// Log database errors
prisma.$on('error', (e) => {
  logger.error(
    {
      target: e.target,
      timestamp: e.timestamp,
    },
    `Database error: ${e.message}`
  );
});

// Log warnings
prisma.$on('warn', (e) => {
  logger.warn(
    {
      target: e.target,
      timestamp: e.timestamp,
    },
    `Database warning: ${e.message}`
  );
});

if (isDevelopment) {
  prisma.$on('info', (e) => {
    logger.info(
      {
        target: e.target,
        timestamp: e.timestamp,
      },
      `Database info: ${e.message}`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────────────────

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = parseInt(process.env.DB_MAX_RETRIES) || 5;
const RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY) || 5000;

/**
 * Connect to database with retry logic
 * @param {number} [retryCount=0] - Current retry attempt
 * @returns {Promise<boolean>}
 */
async function connectDatabase(retryCount = 0) {
  if (isConnected) {
    logger.info('Database already connected');
    return true;
  }

  try {
    connectionAttempts++;
    
    await prisma.$connect();
    
    // Verify connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    isConnected = true;
    
    logger.info(
      {
        attempts: connectionAttempts,
        environment: process.env.NODE_ENV,
      },
      '✅ MySQL Database connected successfully'
    );
    
    // Reset connection attempts on success
    connectionAttempts = 0;
    
    return true;
  } catch (error) {
    isConnected = false;
    
    logger.error(
      {
        err: error,
        attempt: retryCount + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
      },
      `❌ Database connection failed: ${error.message}`
    );

    // Retry logic
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      
      logger.warn(
        { retryIn: `${delay}ms`, attempt: retryCount + 1 },
        `Retrying database connection...`
      );
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDatabase(retryCount + 1);
    }

    // Max retries exceeded
    logger.fatal('Max database connection attempts exceeded');
    throw error;
  }
}

/**
 * Gracefully disconnect from database
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  if (!isConnected) {
    logger.info('Database already disconnected');
    return;
  }

  try {
    await prisma.$disconnect();
    isConnected = false;
    
    logger.info('📤 Database disconnected gracefully');
  } catch (error) {
    logger.error(
      { err: error },
      `Error during database disconnection: ${error.message}`
    );
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check database health
 * @returns {Promise<Object>}
 */
async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return {
      status: 'healthy',
      connected: isConnected,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
    
    return {
      status: 'unhealthy',
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Transaction Helper with Retry
// ─────────────────────────────────────────────────────────────────────────

/**
 * Execute database transaction with automatic retry on deadlock
 * @param {Function} fn - Transaction callback
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @returns {Promise<any>}
 */
async function executeTransaction(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      });
    } catch (error) {
      lastError = error;

      // Retry only on deadlock errors
      if (
        error.code === 'P2034' || // Prisma deadlock
        error.message.includes('deadlock') ||
        error.message.includes('Deadlock')
      ) {
        if (attempt < maxRetries) {
          const delay = 100 * Math.pow(2, attempt);
          logger.warn(
            { attempt: attempt + 1, retryIn: `${delay}ms` },
            'Transaction deadlock detected, retrying...'
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      // Don't retry other errors
      throw error;
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────
// Graceful Shutdown Handler
// ─────────────────────────────────────────────────────────────────────────

if (isProduction) {
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down database connection...');
    await disconnectDatabase();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Connection State Getter
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get current connection status
 * @returns {boolean}
 */
function isDatabaseConnected() {
  return isConnected;
}

// ─────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
  executeTransaction,
  isDatabaseConnected,
};