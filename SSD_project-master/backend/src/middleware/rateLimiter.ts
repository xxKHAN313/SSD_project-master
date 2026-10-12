/**
 * rateLimiter.ts
 *
 * express-rate-limit configurations for all endpoint categories.
 * rate limiting is the primary defense against brute-force, DoS, and spam.
 * each limiter is tuned to its endpoint's expected traffic pattern.
 * rate limit breaches are logged to the audit trail.
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { RATE_LIMITS } from '../config/constants';
import { RATE_LIMIT_ERRORS } from '../utils/errorMessages';
import { HTTP_STATUS, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../config/constants';
import { createLog } from '../services/auditService';
import { logger } from '../utils/logger';

/**
 * shared rate limit response handler.
 * logs the breach and returns a generic 429 response.
 * the handler signature matches what express-rate-limit expects.
 */
function onRateLimitReached(
  errorMessage: string
): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    const userId = req.user?.userId;
    const username = req.user?.username;
    const ipAddress = req.ip ?? 'unknown';

    logger.warn('[rateLimiter] rate limit exceeded', {
      path: req.path,
      ip: ipAddress,
      userId,
      username,
    });

    // fire-and-forget audit log — do not block the response
    createLog({
      userId: userId ?? null,
      username: username ?? null,
      action: AUDIT_ACTIONS.RATE_LIMIT_BREACH,
      details: {
        path: req.path,
        method: req.method,
        ip: ipAddress,
      },
      severity: AUDIT_SEVERITY.WARNING,
      req,
      success: false,
    }).catch(() => {
      // audit failure should not affect rate limit response
    });

    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: errorMessage,
    });
  };
}

/**
 * login rate limiter: 5 attempts per 15 minutes per IP.
 * this is the most critical rate limiter — it directly protects
 * against brute-force credential attacks.
 * note: account lockout provides an additional layer after 5 failures.
 */
export const loginRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.LOGIN.windowMs,
  max: RATE_LIMITS.LOGIN.max,
  standardHeaders: true, // return RateLimit-* headers in response
  legacyHeaders: false, // disable X-RateLimit-* headers (use standard headers)
  keyGenerator: (req) => {
    // key by IP address — prevents one IP from testing many credentials
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  },
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_LOGIN_ATTEMPTS),
  skip: (req) => {
    // skip rate limiting in test environment
    return process.env['NODE_ENV'] === 'test';
  },
});

/**
 * authenticated API rate limiter: 100 requests per minute per user.
 * keys by user ID to track per-user usage, not per-IP.
 * prevents authenticated users from hammering the API.
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.API_AUTH.windowMs,
  max: RATE_LIMITS.API_AUTH.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // use authenticated user ID as the key
    // fall back to IP for unauthenticated requests that slip through
    return req.user?.userId ?? req.ip ?? 'unknown';
  },
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS),
  skip: (req) => process.env['NODE_ENV'] === 'test',
});

/**
 * unauthenticated API rate limiter: 50 requests per minute per IP.
 * applied to public endpoints to prevent scraping and probing.
 */
export const unauthRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.API_UNAUTH.windowMs,
  max: RATE_LIMITS.API_UNAUTH.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS),
  skip: (req) => process.env['NODE_ENV'] === 'test',
});

/**
 * message sending rate limiter: 10 messages per minute per user.
 * prevents message flooding/spam in chat rooms.
 * keyed by user ID.
 */
export const messageRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.MESSAGE.windowMs,
  max: RATE_LIMITS.MESSAGE.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId ?? req.ip ?? 'unknown';
  },
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_MESSAGES),
  skip: (req) => process.env['NODE_ENV'] === 'test',
});

/**
 * read operation rate limiter: 500 requests per minute per user.
 * higher limit for read-only endpoints (messages, rooms, users).
 * prevents excessive polling behavior.
 */
export const readRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.READ.windowMs,
  max: RATE_LIMITS.READ.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId ?? req.ip ?? 'unknown';
  },
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS),
  skip: (req) => process.env['NODE_ENV'] === 'test',
});

/**
 * password reset rate limiter: 3 requests per hour per IP.
 * prevents attackers from abusing the password reset flow
 * to enumerate user email addresses or overwhelm the email server.
 */
export const passwordResetRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMITS.PASSWORD_RESET.windowMs,
  max: RATE_LIMITS.PASSWORD_RESET.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: onRateLimitReached(RATE_LIMIT_ERRORS.TOO_MANY_RESET_REQUESTS),
  skip: (req) => process.env['NODE_ENV'] === 'test',
});
