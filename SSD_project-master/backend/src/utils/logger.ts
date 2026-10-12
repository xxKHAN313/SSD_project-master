/**
 * logger.ts
 *
 * winston-based structured logger with console and file transports.
 * sensitive fields are automatically redacted before logging to prevent
 * credential leakage in log files or monitoring systems.
 * all application code must use this logger — no console.log in production.
 */

import winston from 'winston';
import path from 'path';

// fields that must never appear in log output — redacted before writing
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'tokenHash',
  'authorization',
  'cookie',
  'secret',
  'encryptionKey',
  'iv',
  'authTag',
  'creditCard',
  'ssn',
];

/**
 * recursively redacts sensitive fields from an object before logging.
 * this prevents accidental logging of passwords, tokens, or keys.
 */
function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  // prevent infinite recursion on deeply nested objects
  if (depth > 5) return '[max depth reached]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactSensitiveFields(value, depth + 1);
    }
  }
  return redacted;
}

/**
 * custom winston format that applies field redaction to the log metadata.
 */
const redactFormat = winston.format((info) => {
  // redact the metadata object (everything except level, message, timestamp)
  const { level, message, timestamp, ...meta } = info;
  const redactedMeta = redactSensitiveFields(meta) as Record<string, unknown>;
  return { level, message, timestamp, ...redactedMeta };
});

/**
 * log format for console output — human-readable colored output for development.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactFormat(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp as string}] ${level}: ${message as string}${metaStr}`;
  })
);

/**
 * log format for file output — machine-readable json for log aggregation tools.
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactFormat(),
  winston.format.json()
);

// determine log level from environment — default to 'info'
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

// determine log directory relative to project root
const logDir = path.resolve(process.cwd(), 'logs');

/**
 * the application logger instance.
 * transports:
 * - console: all levels during development; only warn+ in production
 * - combined.log: all log entries (json format)
 * - error.log: error-level only (json format)
 */
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'shield-chat' },
  transports: [
    // console transport — reduced noise in production
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env['NODE_ENV'] === 'test',
    }),

    // combined log file — all levels
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // rotate at 10mb
      maxFiles: 5,
    }),

    // error-only log file — easier to monitor for critical issues
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  // do not crash the process on unhandled exceptions in logger
  exitOnError: false,
});

// capture uncaught exceptions to error log before process exit
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    format: fileFormat,
  })
);

export type Logger = typeof logger;
