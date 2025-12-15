// ===========================================
// SERVER ENTRY POINT - DUBILIST MARKETPLACE
// ===========================================

require('dotenv').config();

const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('==========================================');
      console.log(`🚀 DUBILIST MARKETPLACE API`);
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`📋 Health: http://localhost:${PORT}/health`);
      console.log('==========================================');
      console.log('');
      console.log('📚 API Endpoints:');
      console.log(`   POST /api/auth/register`);
      console.log(`   POST /api/auth/login`);
      console.log(`   GET  /api/auth/me`);
      console.log(`   GET  /api/categories`);
      console.log(`   GET  /api/listings`);
      console.log(`   POST /api/listings`);
      console.log(`   GET  /api/search?q=`);
      console.log(`   GET  /api/favorites`);
      console.log(`   GET  /api/chat/rooms`);
      console.log(`   POST /api/admin/login`);
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down...');
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled rejections  
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Start
startServer();