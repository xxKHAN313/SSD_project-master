/**
 * connection.ts
 *
 * MongoDB connection management via Mongoose.
 * establishes a connection pool to MongoDB using the URI from the environment.
 * registers connection event listeners for observability.
 * exports connectDB and disconnectDB for use in server.ts and tests.
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * connects to MongoDB using the MONGODB_URI environment variable.
 * throws if the URI is not set or if the initial connection fails.
 * mongoose will automatically attempt to reconnect on subsequent failures.
 *
 * connection pool settings:
 * - maxPoolSize: 10 — supports up to 10 concurrent operations
 * - serverSelectionTimeoutMS: 5000 — fail fast if MongoDB is unreachable at startup
 * - socketTimeoutMS: 45000 — abort hung queries after 45 seconds
 */
export async function connectDB(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    throw new Error('[database] MONGODB_URI environment variable is not set. Cannot connect to MongoDB.');
  }

  // register connection lifecycle event listeners before connecting.
  // these log state transitions for observability and alerting.
  mongoose.connection.on('connected', () => {
    logger.info('[database] MongoDB connection established');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error('[database] MongoDB connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[database] MongoDB disconnected — Mongoose will attempt to reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('[database] MongoDB reconnected');
  });

  await mongoose.connect(uri, {
    maxPoolSize: 10,           // maximum concurrent operations
    serverSelectionTimeoutMS: 5000,  // fail fast on startup if MongoDB unreachable
    socketTimeoutMS: 45000,    // abort queries that run longer than 45 seconds
  });
}

/**
 * gracefully closes the MongoDB connection.
 * called during graceful shutdown to ensure all pending operations complete.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('[database] MongoDB connection closed gracefully');
}
