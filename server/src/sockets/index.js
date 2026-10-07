import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { registerHostHandlers } from './hostHandlers.js';
import { registerPlayerHandlers } from './playerHandlers.js';

/**
 * Initializes Socket.io with Express HTTP server and registers middleware & handlers.
 */
export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Optional JWT Handshake middleware:
  // - If a token is supplied (host client), verify it and attach user identity.
  // - If invalid, reject connection with Unauthorized.
  // - If no token supplied, allow connection as guest player.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        socket.data.user = decoded; // { id: userId, ... }
        return next();
      } catch (err) {
        return next(new Error('Unauthorized'));
      }
    }
    // Guest player connection (no token needed)
    return next();
  });

  io.on('connection', (socket) => {
    // Register host and player socket handlers
    registerHostHandlers(io, socket);
    registerPlayerHandlers(io, socket);
  });

  return io;
}
