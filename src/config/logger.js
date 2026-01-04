// ===========================================
// LOGGER CONFIGURATION (PINO)
// ===========================================

const pino = require('pino');
const { env } = require('./env');

const logger = pino({
  level: env.LOG_LEVEL || 'info', // ✅ FIXED
  transport: env.LOG_PRETTY
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: env.NODE_ENV,
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    error: pino.stdSerializers.err,
  },
});

// Create child logger for specific modules
const createModuleLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};

module.exports = { logger, createModuleLogger };
