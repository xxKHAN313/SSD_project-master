/**
 * database.ts
 *
 * mongoose connection configuration with event handlers,
 * graceful shutdown support, and connection retry logic.
 * exported as a singleton connection config object.
 */

import mongoose from 'mongoose';
import { env } from './environment';
import { logger } from '../utils/logger';

/**
 * mongoose connection options.
 * serverSelectionTimeoutMS: fail fast if mongo is unreachable (5s)
 * socketTimeoutMS: close idle sockets after 45s
 * maxPoolSize: limit concurrent connections to prevent resource exhaustion
 */
const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  // autoIndex should be false in production for performance,
  // but enabled in development for convenience
  autoIndex: !env.isProduction,
};

// track connection state to avoid duplicate connection attempts
let isConnected = false;

/**
 * establishes the mongoose/mongodb connection.
 * registers event listeners for connection lifecycle events.
 * throws on initial connection failure to prevent startup in broken state.
 */
export async function connectDB(): Promise<void> {
  if (isConnected) {
    logger.info('[database] already connected to mongodb');
    return;
  }

  try {
    logger.info('[database] connecting to mongodb...');

    // register event handlers before connecting
    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info('[database] mongoose connected to mongodb');
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('[database] mongoose disconnected from mongodb');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      logger.info('[database] mongoose reconnected to mongodb');
    });

    mongoose.connection.on('error', (err: Error) => {
      // log the error but don't crash — mongoose will attempt to reconnect
      logger.error('[database] mongoose connection error', { error: err.message });
    });

    await mongoose.connect(env.mongodbUri, MONGOOSE_OPTIONS);
    isConnected = true;
    logger.info('[database] initial mongodb connection established');
  } catch (error) {
    const err = error as Error;
    logger.error('[database] failed to connect to mongodb', { error: err.message });
    // rethrow so the server startup fails loudly — better than silently running without db
    throw error;
  }
}

/**
 * gracefully closes the mongoose connection.
 * called during SIGTERM/SIGINT shutdown to ensure in-flight
 * operations complete before the process exits.
 */
export async function disconnectDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('[database] mongodb connection closed gracefully');
  } catch (error) {
    const err = error as Error;
    logger.error('[database] error closing mongodb connection', { error: err.message });
    throw error;
  }
}

/**
 * returns the current mongoose connection state.
 * states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
 */
export function getConnectionState(): number {
  return mongoose.connection.readyState;
}

export { mongoose };
