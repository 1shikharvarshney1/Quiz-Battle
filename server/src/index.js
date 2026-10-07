import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocketServer } from './sockets/index.js';
import { clearAllGames } from './game/gameStore.js';
import mongoose from 'mongoose';

// Connect to MongoDB
await connectDB();

// Create HTTP server
const httpServer = http.createServer(app);

// Bootstrap Socket.io
const io = initSocketServer(httpServer);

// Start listening
const server = httpServer.listen(env.PORT, () => {
  console.log(`[Server] Quiz Battle server running on http://localhost:${env.PORT}`);
  console.log(`[Server] Client origin: ${env.CLIENT_ORIGIN}`);
  console.log(`[Server] LLM Provider: ${env.GEMINI_API_KEY ? 'Google Gemini' : 'Mock Mode (No API Key)'}`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  clearAllGames();
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('[Server] MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io, httpServer };
