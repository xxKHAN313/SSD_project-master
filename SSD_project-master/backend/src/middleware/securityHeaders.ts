/**
 * securityHeaders.ts
 *
 * Helmet.js security headers configuration.
 * Helmet sets HTTP response headers that protect against common web vulnerabilities:
 * - Content-Security-Policy: prevents XSS and content injection (nonce-based)
 * - HSTS: forces HTTPS connections (browsers ignore over http per RFC 6797 §8.1)
 * - X-Frame-Options: prevents clickjacking (also mirrored in frame-ancestors)
 * - X-Content-Type-Options: prevents MIME-type sniffing
 * - Referrer-Policy: controls referrer information
 *
 * IMPORTANT: this middleware must run AFTER the cspNonce middleware so that
 * `res.locals.cspNonce` is populated before the CSP header is built.
 */

import helmet from 'helmet';
import { CSP_DIRECTIVES } from '../config/security';

/**
 * Helmet middleware with full security header configuration.
 * Applied as one of the first middlewares to ensure headers are
 * set on every response, including error responses.
 */
export const securityHeaders = helmet({
  // Content-Security-Policy — restricts resource loading sources.
  // Uses per-request nonces for script-src and style-src-elem so the
  // policy does not require `'unsafe-inline'`. Inline style="" attrs
  // are permitted via `style-src-attr 'unsafe-inline'`, which cannot
  // be used to execute script.
  contentSecurityPolicy: {
    // Disable helmet's defaults — everything we need is listed below,
    // and the defaults include `upgrade-insecure-requests` which breaks
    // plain-http LAN access.
    useDefaults: false,
    directives: {
      defaultSrc: CSP_DIRECTIVES.defaultSrc,
      scriptSrc: CSP_DIRECTIVES.scriptSrc,
      scriptSrcAttr: CSP_DIRECTIVES.scriptSrcAttr,
      styleSrc: CSP_DIRECTIVES.styleSrc,
      styleSrcElem: CSP_DIRECTIVES.styleSrcElem,
      styleSrcAttr: CSP_DIRECTIVES.styleSrcAttr,
      imgSrc: CSP_DIRECTIVES.imgSrc,
      connectSrc: CSP_DIRECTIVES.connectSrc,
      fontSrc: CSP_DIRECTIVES.fontSrc,
      objectSrc: CSP_DIRECTIVES.objectSrc,
      mediaSrc: CSP_DIRECTIVES.mediaSrc,
      frameSrc: CSP_DIRECTIVES.frameSrc,
      frameAncestors: CSP_DIRECTIVES.frameAncestors,
      baseUri: CSP_DIRECTIVES.baseUri,
      formAction: CSP_DIRECTIVES.formAction,
      workerSrc: CSP_DIRECTIVES.workerSrc,
      manifestSrc: CSP_DIRECTIVES.manifestSrc,
    },
  },

  // HTTP Strict Transport Security.
  // Setting HSTS unconditionally is safe: browsers ignore the header
  // entirely when a page is served over plain HTTP (RFC 6797 §8.1),
  // so LAN / localhost users are unaffected. When the app is reached
  // via the HTTPS tunnel, this pins the browser to HTTPS for 1 year.
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false, // don't auto-preload; the hostname rotates per deployment
  },

  // X-Frame-Options: DENY — legacy but still emitted for old browsers.
  // Modern browsers use `frame-ancestors 'none'` from the CSP above.
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options: nosniff
  // prevents browser from MIME-sniffing responses.
  noSniff: true,

  // X-XSS-Protection: 0 — modern browsers don't use this header;
  // setting 0 avoids legacy bypass vectors (ZAP flags values other than 0).
  xssFilter: false,

  // Referrer-Policy: strict-origin-when-cross-origin
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // hide X-Powered-By — don't reveal Express
  hidePoweredBy: true,

  // Cross-Origin-Embedder-Policy: disabled to avoid breaking 3rd-party integrations
  crossOriginEmbedderPolicy: false,

  // Cross-Origin-Opener-Policy: same-origin
  crossOriginOpenerPolicy: { policy: 'same-origin' },

  // Cross-Origin-Resource-Policy: same-origin
  crossOriginResourcePolicy: { policy: 'same-origin' },
});
