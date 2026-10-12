/**
 * socketManager.ts
 *
 * Socket.io server initialization and online user tracking.
 * initializes the Socket.io server with the shared HTTP server,
 * applies authentication middleware, and registers event handlers
 * for each new connection.
 *
 * online user tracking:
 * - uses a Map<userId, Set<socketId>> to support multiple tabs/devices per user
 * - user-offline is only emitted when ALL connections for that user close
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './socketAuth';
import { registerSocketHandlers } from './socketHandlers';
import { logger } from '../utils/logger';

// tracks all active socket connections per user.
// userId -> Set of socketIds (a user can have multiple connections from different tabs)
const onlineUsers: Map<string, Set<string>> = new Map();

// singleton Socket.io server instance
let io: Server;

/**
 * initializes the Socket.io server and attaches it to the provided HTTP server.
 * applies JWT authentication middleware and registers event handlers for all connections.
 * must be called once during server startup after the HTTP server is created.
 *
 * @param httpServer - the Node.js HTTP server instance (created from the Express app)
 * @returns the initialized Socket.io server
 */
export function initializeSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      // read from environment — falls back to localhost for development
      origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
      credentials: true, // allow cookies in cross-origin socket connections
      methods: ['GET', 'POST'],
    },
    // ping/pong settings — controls how quickly stale connections are detected
    pingTimeout: 60000, // 60s — close the connection if no pong received
    pingInterval: 25000, // 25s — send a ping every 25 seconds
  });

  // apply JWT authentication to ALL incoming socket connections.
  // unauthenticated connections are rejected here before any events fire.
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket) => {
    const userId = socket.data['userId'] as string;
    const username = socket.data['username'] as string;

    // register this socket in the online users map
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // broadcast to all connected clients that this user came online.
    // only emit if this is the user's first connection (not a duplicate tab).
    const userSocketCount = onlineUsers.get(userId)!.size;
    if (userSocketCount === 1) {
      io.emit('user-online', { userId, username });
    }

    logger.info('[socketManager] user connected', {
      userId,
      username,
      socketId: socket.id,
      totalConnections: userSocketCount,
    });

    // register all chat event handlers (join-room, send-message, typing, etc.)
    registerSocketHandlers(io, socket);

    // handle disconnection — clean up online user tracking
    socket.on('disconnect', (reason) => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // only emit user-offline when ALL connections for this user are closed
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user-offline', { userId, username });
          logger.info('[socketManager] user fully disconnected (all tabs closed)', {
            userId,
            username,
            reason,
          });
        } else {
          logger.debug('[socketManager] socket closed, user still has other connections', {
            userId,
            username,
            remainingConnections: userSockets.size,
            reason,
          });
        }
      }
    });
  });

  logger.info('[socketManager] Socket.io server initialized');
  return io;
}

/**
 * returns the singleton Socket.io server instance.
 * throws if called before initializeSocketIO.
 *
 * @returns the Socket.io Server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('[socketManager] Socket.io server has not been initialized. Call initializeSocketIO first.');
  }
  return io;
}

/**
 * returns the list of currently online user IDs.
 *
 * @returns array of userId strings with at least one active connection
 */
export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

/**
 * checks whether a specific user has any active socket connections.
 *
 * @param userId - the MongoDB ObjectId string of the user
 * @returns true if the user has at least one active connection
 */
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size ?? 0) > 0;
}
