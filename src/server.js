// ===========================================
// SERVER WITH SOCKET.IO - DUBILIST MARKETPLACE
// ===========================================

require('dotenv').config();

const { server } = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server with Socket.IO
    server.listen(PORT, () => {
      console.log('');
      console.log('==========================================');
      console.log(`🚀 DUBILIST MARKETPLACE API`);
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`📡 Socket.IO: ws://localhost:${PORT}`);
      console.log(`📋 Health: http://localhost:${PORT}/health`);
      console.log('==========================================');
      console.log('');
      console.log('🔒 Chat Security Features:');
      console.log('   ✓ JWT Authentication required');
      console.log('   ✓ No images/files allowed');
      console.log('   ✓ Vulgar language blocked');
      console.log('   ✓ Max 1000 chars per message');
      console.log('   ✓ HTML sanitization');
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