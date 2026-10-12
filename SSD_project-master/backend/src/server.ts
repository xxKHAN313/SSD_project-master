/**
 * server.ts
 *
 * Application entry point for Shield-Chat backend.
 * orchestrates startup in the correct order:
 * 1. connect to MongoDB (fail fast if unavailable)
 * 2. create the Express application
 * 3. create the HTTP server
 * 4. initialize Socket.io on the HTTP server
 * 5. start listening on the configured port
 *
 * also registers graceful shutdown handlers for SIGTERM and SIGINT signals,
 * and process-level handlers for uncaught exceptions and unhandled promise rejections.
 */

import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { connectDB, disconnectDB } from './database/connection';
import { initializeSocketIO } from './websocket/socketManager';
import { logger } from './utils/logger';

// parse port from environment, default to 5000
const PORT = parseInt(process.env['PORT'] ?? '5000', 10);

// bind host — default 0.0.0.0 so the server is reachable from other devices
// on the LAN (needed for phone testing, office demos, and reverse tunnels).
// override via HOST env var if you need loopback-only (127.0.0.1).
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * starts the server by connecting to the database and then listening for connections.
 * all initialization errors are propagated to the top-level catch.
 */
async function startServer(): Promise<void> {
  // step 1: connect to MongoDB — fail fast if the database is unavailable.
  // the application cannot serve requests without a database connection.
  await connectDB();

  // step 2: create the configured Express application
  const app = createApp();

  // step 3: create the HTTP server wrapping the Express app.
  // socket.io requires access to the HTTP server (not just the Express app)
  // to intercept the WebSocket upgrade requests.
  const httpServer = http.createServer(app);

  // step 4: attach Socket.io to the HTTP server with JWT authentication middleware
  initializeSocketIO(httpServer);

  // step 5: start listening
  httpServer.listen(PORT, HOST, () => {
    logger.info(`[server] Shield-Chat backend listening on ${HOST}:${PORT}`);
    logger.info(`[server] Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
    logger.info(`[server] Health check: http://localhost:${PORT}/api/health`);
  });

  // -----------------------------------------------------------------------
  // graceful shutdown handlers
  // -----------------------------------------------------------------------

  /**
   * graceful shutdown: close the HTTP server (stops accepting new connections),
   * then close the database connection, then exit cleanly.
   *
   * @param signal - the OS signal that triggered the shutdown
   */
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[server] Received ${signal} — initiating graceful shutdown`);

    // stop accepting new connections while finishing in-flight requests
    httpServer.close(async () => {
      logger.info('[server] HTTP server closed');

      try {
        await disconnectDB();
      } catch (err) {
        logger.error('[server] Error during database disconnect', {
          error: (err as Error).message,
        });
      }

      logger.info('[server] Graceful shutdown complete');
      process.exit(0);
    });

    // force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('[server] Forced shutdown after timeout — some requests may have been dropped');
      process.exit(1);
    }, 10000).unref(); // unref so the timeout doesn't prevent earlier exit
  };

  // handle container shutdown signals
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // handle unexpected errors at the process level
  // log them and exit so the process manager (PM2, Docker, etc.) can restart

  process.on('uncaughtException', (err: Error) => {
    logger.error('[server] Uncaught exception — exiting to prevent undefined state', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('[server] Unhandled promise rejection — exiting to prevent undefined state', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    process.exit(1);
  });
}

// top-level entry point — start the server and handle any startup failures
startServer().catch((err: Error) => {
  // use console.error here in case the logger itself failed to initialize
  console.error('[server] Failed to start:', err.message);
  console.error(err.stack);
  process.exit(1);
});
