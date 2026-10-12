/**
 * security.ts
 *
 * centralizes all security-related configuration:
 * bcrypt rounds, jwt signing options, cookie security settings, and cors origins.
 * these values drive the security posture of the entire application.
 */

import { CookieOptions } from 'express';
import { SignOptions } from 'jsonwebtoken';
import type { IncomingMessage, ServerResponse } from 'http';
import { env } from './environment';

/**
 * Helmet's CSP directive functions receive raw (req, res) from the Node http
 * module, but at runtime Express decorates `res` with `.locals`. This helper
 * extracts the nonce placed there by the cspNonce middleware.
 */
function nonceFrom(_req: IncomingMessage, res: ServerResponse): string {
  const nonce = (res as unknown as { locals?: { cspNonce?: string } }).locals?.cspNonce ?? '';
  return `'nonce-${nonce}'`;
}

/**
 * bcrypt work factor (salt rounds).
 * 12 rounds provides strong protection against brute-force
 * while remaining within acceptable server response times (~300ms).
 * never go below 10 in production.
 */
export const BCRYPT_ROUNDS = env.bcryptRounds;

/**
 * jwt signing options for access tokens.
 * short expiry (1h) limits exposure if a token is stolen.
 * algorithm HS256 is standard for symmetric jwt; RS256 could be used for multi-service.
 */
export const JWT_ACCESS_OPTIONS: SignOptions = {
  expiresIn: env.jwt.accessExpiry as SignOptions['expiresIn'],
  algorithm: 'HS256',
  issuer: 'shield-chat',
  audience: 'shield-chat-client',
};

/**
 * jwt signing options for refresh tokens.
 * longer expiry (7d) allows session persistence.
 * stored as hashed value in db — raw token is never stored.
 */
export const JWT_REFRESH_OPTIONS: SignOptions = {
  expiresIn: env.jwt.refreshExpiry as SignOptions['expiresIn'],
  algorithm: 'HS256',
  issuer: 'shield-chat',
  audience: 'shield-chat-client',
};

/**
 * secure cookie options for http-only token cookies.
 * - httpOnly: prevents javascript from reading the cookie (xss protection)
 * - secure: cookie only sent over https (enforced in production)
 * - sameSite: 'strict' prevents csrf from cross-site requests
 * - these settings implement the "secure cookie" security pattern
 */
export const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction, // only send over https in production
  sameSite: 'strict',
  maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
  path: '/',
};

export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/api/auth/refresh', // restrict refresh cookie to refresh endpoint only
};

/**
 * cookie options for clearing tokens on logout.
 * must match the same path/domain as set cookies to properly clear them.
 */
export const CLEAR_ACCESS_TOKEN_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  maxAge: 0,
  path: '/',
};

export const CLEAR_REFRESH_TOKEN_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  maxAge: 0,
  path: '/api/auth/refresh',
};

/**
 * allowed cors origins whitelist.
 * requests from unlisted origins will be rejected.
 * in production this should only contain the production frontend url.
 */
export const CORS_WHITELIST: string[] = env.corsOrigins;

/**
 * cors configuration object for use with the cors middleware package.
 * credentials: true allows cookies/auth headers to be sent cross-origin
 * (only works with explicit origins, not '*').
 */
// ephemeral tunnel / preview hostnames we routinely want to accept so the app
// can be deployed via a quick tunnel without recompiling. these are pattern-
// matched against the Origin hostname, not exact strings.
const TUNNEL_HOSTNAME_PATTERNS: RegExp[] = [
  /\.trycloudflare\.com$/i,
  /\.ngrok-free\.app$/i,
  /\.ngrok\.io$/i,
  /\.loca\.lt$/i,
  /\.serveo\.net$/i,
  /\.serveousercontent\.com$/i,
];

// private/loopback address patterns — allow LAN access in development so the
// app can be tested from phones or other machines on the same network.
const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
];

function isAllowedOrigin(origin: string): boolean {
  if (CORS_WHITELIST.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (TUNNEL_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) return true;
    // private LAN hostnames allowed in non-production
    if (!env.isProduction && PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) {
      return true;
    }
  } catch {
    // malformed Origin header — fall through to deny
  }
  return false;
}

export const CORS_OPTIONS = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // allow requests with no origin (e.g., mobile apps, server-to-server, curl)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      // reject requests from unlisted origins with a generic error
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true, // allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-XSRF-TOKEN',
    'X-Requested-With',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // cache preflight response for 24 hours
};

/**
 * content security policy directives for helmet.
 * these headers instruct browsers on what content sources are trusted,
 * providing a strong defense against xss and injection attacks.
 *
 * Note on nonces: helmet resolves any directive value that is a function
 * against the (req, res) pair at response time, so we can pull
 * `res.locals.cspNonce` (populated by the cspNonce middleware) to get a
 * fresh per-request nonce. This lets us drop `'unsafe-inline'` from
 * script-src entirely.
 *
 * We keep `'unsafe-inline'` ONLY on `style-src-attr` (the narrowest
 * directive, covering inline `style=""` attributes that CRA/React
 * sometimes emits for 3rd-party UI libs). Modern browsers honour
 * `style-src-attr` as a separate directive, so this does not relax
 * `style-src-elem` which governs <style> tags — those still require
 * the nonce.
 */
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", nonceFrom],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'", nonceFrom],
  styleSrcElem: ["'self'", nonceFrom],
  styleSrcAttr: ["'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'", 'ws:', 'wss:', ...env.corsOrigins],
  fontSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"], // block flash/plugins
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"], // prevent embedding in iframes
  frameAncestors: ["'none'"], // modern equivalent of X-Frame-Options: DENY
  baseUri: ["'self'"], // prevent <base> tag injection hijacking relative URLs
  formAction: ["'self'"], // restrict where forms can POST to
  workerSrc: ["'self'", 'blob:'], // allow webpack worker chunks
  manifestSrc: ["'self'"],
};
