/**
 * csrfMiddleware.ts
 *
 * CSRF (Cross-Site Request Forgery) protection middleware.
 * uses the double-submit cookie pattern:
 * 1. server generates a random token on first visit and sets it as a cookie
 * 2. client reads the cookie value and includes it in a custom request header
 * 3. server compares the header value against the cookie value
 *
 * this works because cross-site requests cannot read httpOnly cookies,
 * and custom headers cannot be set by cross-site HTML forms.
 *
 * note: CSRF protection is less critical for pure-JSON APIs with
 * SameSite=Strict cookies, but is included as defense-in-depth.
 * CSRF checks are skipped for GET/HEAD/OPTIONS (safe methods per RFC 7231).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { HTTP_STATUS, COOKIE_NAMES } from '../config/constants';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

// safe http methods do not require CSRF protection (they should not cause state changes)
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// csrf token length in bytes (32 bytes = 256-bit entropy)
const TOKEN_BYTES = 32;

/**
 * generates a cryptographically secure CSRF token.
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * timing-safe comparison of two strings.
 * prevents timing attacks on token comparison.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // crypto.timingSafeEqual requires buffers of equal length
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * CSRF token middleware.
 *
 * on GET requests: generates a CSRF token, stores it in a non-httpOnly cookie
 * so the client JS can read it, and makes the token value available in res.locals.
 *
 * on POST/PUT/DELETE requests: validates the X-CSRF-Token header against
 * the csrf_token cookie value.
 *
 * the csrf cookie is NOT httpOnly (client JS needs to read it)
 * but IS SameSite=Strict and Secure in production.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // skip csrf for safe methods
  if (SAFE_METHODS.has(req.method)) {
    // issue/renew CSRF token on GET requests
    let csrfToken = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN] as string | undefined;

    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      // not httpOnly — client JS must be able to read this cookie
      res.cookie(COOKIE_NAMES.CSRF_TOKEN, csrfToken, {
        httpOnly: false, // intentionally readable by JS
        secure: env.isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
    }

    // make token available to templates/responses if needed
    res.locals['csrfToken'] = csrfToken;
    next();
    return;
  }

  // for state-changing methods, validate the token
  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN] as string | undefined;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!cookieToken || !headerToken) {
    logger.warn('[csrfMiddleware] CSRF token missing', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    });

    res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'CSRF validation failed. Please refresh the page and try again.',
    });
    return;
  }

  // timing-safe comparison to prevent oracle attacks
  if (!safeCompare(cookieToken, headerToken)) {
    logger.warn('[csrfMiddleware] CSRF token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'CSRF validation failed. Please refresh the page and try again.',
    });
    return;
  }

  next();
}
