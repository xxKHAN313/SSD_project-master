/**
 * environment.ts
 *
 * centralizes all environment variable validation and export.
 * throws at startup if any required variable is missing, preventing
 * the application from running in an insecure or broken state.
 * all secrets are loaded from process.env — never hardcoded.
 */

import dotenv from 'dotenv';
import path from 'path';

// load .env file from project root relative to this file's location
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * validates a required environment variable. throws if missing or empty.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[environment] required environment variable "${key}" is missing or empty. check your .env file.`);
  }
  return value.trim();
}

/**
 * validates an optional environment variable with a fallback default.
 */
function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

/**
 * validates a required numeric environment variable.
 */
function requireEnvNumber(key: string): number {
  const raw = requireEnv(key);
  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    throw new Error(`[environment] environment variable "${key}" must be a valid integer, got: "${raw}"`);
  }
  return num;
}

/**
 * validates an optional numeric environment variable with a fallback.
 */
function optionalEnvNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw || raw.trim() === '') return defaultValue;
  const num = parseInt(raw.trim(), 10);
  if (isNaN(num)) return defaultValue;
  return num;
}

// validate that the jwt secrets meet minimum length requirements
// short secrets are susceptible to brute-force attacks
const jwtAccessSecret = requireEnv('JWT_ACCESS_SECRET');
const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET');

if (jwtAccessSecret.length < 32) {
  throw new Error('[environment] JWT_ACCESS_SECRET must be at least 32 characters long for security.');
}
if (jwtRefreshSecret.length < 32) {
  throw new Error('[environment] JWT_REFRESH_SECRET must be at least 32 characters long for security.');
}

// validate encryption key — must be exactly 64 hex chars (32 bytes) for AES-256
const encryptionKey = requireEnv('ENCRYPTION_KEY');
if (encryptionKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(encryptionKey)) {
  throw new Error('[environment] ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes) for AES-256.');
}

/**
 * strongly-typed environment configuration object.
 * all values are validated before export.
 */
export const env = {
  // server
  nodeEnv: optionalEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  port: optionalEnvNumber('PORT', 5000),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',

  // database
  mongodbUri: requireEnv('MONGODB_URI'),

  // jwt configuration
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiry: optionalEnv('JWT_ACCESS_EXPIRY', '1h'),
    refreshExpiry: optionalEnv('JWT_REFRESH_EXPIRY', '7d'),
  },

  // aes-256-gcm encryption
  encryption: {
    key: encryptionKey,
    ivLength: optionalEnvNumber('ENCRYPTION_IV_LENGTH', 16),
  },

  // email (nodemailer)
  email: {
    host: optionalEnv('EMAIL_HOST', 'smtp.gmail.com'),
    port: optionalEnvNumber('EMAIL_PORT', 587),
    user: optionalEnv('EMAIL_USER', ''),
    pass: optionalEnv('EMAIL_PASS', ''),
    from: optionalEnv('EMAIL_FROM', 'Shield-Chat <noreply@shield-chat.com>'),
  },

  // cors / frontend
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
  corsOrigins: optionalEnv('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),

  // security
  bcryptRounds: optionalEnvNumber('BCRYPT_ROUNDS', 12),

  // rate limiting
  rateLimiting: {
    windowMs: optionalEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    max: optionalEnvNumber('RATE_LIMIT_MAX', 100),
  },

  // logging
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
} as const;

export type Environment = typeof env;
