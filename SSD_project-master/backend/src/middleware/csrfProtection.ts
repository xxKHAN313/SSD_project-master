/**
 * csrfProtection.ts
 *
 * Double-submit cookie CSRF protection.
 *
 * Pattern:
 *   1. Server issues a random `XSRF-TOKEN` cookie (non-httpOnly, SameSite=strict,
 *      Secure in prod) on every response that doesn't already have one.
 *   2. JS in the SPA reads the cookie and echoes it back as an `X-XSRF-TOKEN`
 *      header on every state-changing request (axios does this automatically
 *      when `xsrfCookieName`/`xsrfHeaderName` are configured).
 *   3. On the server, unsafe methods must have header == cookie.
 *
 * An attacker on a different origin cannot read the XSRF-TOKEN cookie
 * (SameSite=strict blocks it from being sent cross-site, and even if it
 * leaked, they can't read its value across origins to forge the header).
 *
 * Bearer-token auth is CSRF-immune by construction (browsers don't attach
 * Authorization headers to cross-site requests), so requests presenting
 * a valid-looking Bearer token skip the check.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';
const TOKEN_BYTES = 32;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// endpoints that must not be CSRF-gated.
//
//   - /api/health: infrastructure probes have no browser session.
//   - /api/auth/login + /register: user has no session yet, so CSRF (which
//     protects an EXISTING authenticated session) doesn't apply. An attacker
//     can't usefully "log in as someone else" — they'd already need the
//     credentials.
//   - /api/auth/refresh: protected by the httpOnly refresh-token cookie path
//     scoping (cookie only sent on this exact path) AND by the bearer-token
//     bypass below when the access token is still in localStorage.
//   - /api/auth/forgot-password + /reset-password: gated by their own
//     one-time email-delivered token, not by session state.
//
// Limiting CSRF to authenticated state-changing endpoints (which already have
// the bearer-token bypass) avoids the chicken-and-egg problem where a fresh
// browser, or a browser with cached pre-CSRF JS, can't attach the header.
const CSRF_EXEMPT_PATHS = new Set<string>([
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

function isCsrfExempt(reqPath: string): boolean {
  if (CSRF_EXEMPT_PATHS.has(reqPath)) return true;
  // /api/auth/reset-password/:token → also exempt
  if (reqPath.startsWith('/api/auth/reset-password/')) return true;
  return false;
}

/**
 * Issues an `XSRF-TOKEN` cookie if the client doesn't already have one.
 * Runs on every request so the token is available before any mutation.
 */
export function issueCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies || !req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    // NOTE on flags:
    //   - httpOnly MUST be false — the SPA's JS reads this cookie and echoes
    //     it back as the X-XSRF-TOKEN header (double-submit pattern).
    //   - Secure is deliberately NOT set. The token is not a session secret;
    //     browsers reject Secure cookies over plain-http LAN origins, which
    //     would break the SPA on http://192.168.x.x deployments. CSRF
    //     protection still holds via SameSite=Strict (blocks the cookie from
    //     being sent on cross-site requests at all) and CORS (blocks foreign
    //     JS from reading the token).
    //   - sameSite=strict is the primary CSRF defence here.
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'strict',
      path: '/',
    });
    // also attach to req.cookies so a subsequent verify in the same chain sees it
    if (req.cookies) {
      req.cookies[CSRF_COOKIE] = token;
    }
  }
  next();
}

/**
 * Verifies the double-submit token on state-changing methods.
 * Rejects with 403 on mismatch or missing token.
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isCsrfExempt(req.path)) return next();

  // Bearer-auth requests are CSRF-immune — browsers can't forge Authorization
  // on cross-site requests. Skip the check so API clients (curl, Postman,
  // native mobile) still work without needing to pre-fetch a cookie.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken.length > 0 &&
    // timingSafeEqual requires equal-length buffers
    cookieToken.length === headerToken.length &&
    crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next();
  }

  res.status(403).json({
    success: false,
    message: 'Invalid or missing CSRF token.',
  });
}
