// ===========================================
// SERVER WITH SOCKET.IO - DUBILIST MARKETPLACE
// ===========================================

require('dotenv').config();

const { server } = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = parseInt(process.env.PORT, 10) || 3000;

function handleListenError(error) {
  if (error.code === 'EADDRINUSE') {
    console.error('');
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Stop the process using port ${PORT}, or change PORT in .env.`);
    console.error(`   Windows: netstat -ano | findstr :${PORT}`);
    console.error(`   Then:    taskkill /PID <PID> /F`);
    console.error('');
  } else {
    console.error('❌ Server failed to listen:', error);
  }

  disconnectDatabase()
    .catch((disconnectError) => {
      console.error('❌ Failed to disconnect database:', disconnectError.message);
    })
    .finally(() => process.exit(1));
}

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server with Socket.IO
    server.once('error', handleListenError);

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
