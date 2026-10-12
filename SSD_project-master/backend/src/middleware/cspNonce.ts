/**
 * cspNonce.ts
 *
 * Generates a fresh per-request nonce used by the Content-Security-Policy
 * `script-src` and `style-src` directives. The same nonce is also injected
 * into the served index.html (replacing the `__CSP_NONCE__` placeholder)
 * so that the CRA-generated inline runtime chunk and style-loader-injected
 * <style> blocks are accepted without needing `'unsafe-inline'`.
 *
 * Runs BEFORE helmet so helmet can read `res.locals.cspNonce` when
 * rendering the CSP header.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function cspNonce(_req: Request, res: Response, next: NextFunction): void {
  // 16 random bytes → 22-char base64 (url-safe chars only after we strip =)
  // base64 is the canonical encoding for CSP nonces (RFC 7636 style).
  res.locals['cspNonce'] = crypto.randomBytes(16).toString('base64');
  next();
}
