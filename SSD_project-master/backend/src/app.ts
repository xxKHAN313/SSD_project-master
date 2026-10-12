/**
 * app.ts
 *
 * Express application factory.
 * configures all middleware in the correct security-first order:
 * 1. Strip server fingerprint headers — hides Server / X-Powered-By
 * 2. Per-request CSP nonce — must run BEFORE helmet so helmet can read it
 * 3. Security headers (Helmet) — must be early so headers are on all responses
 * 4. CORS — must precede routes to handle preflight OPTIONS requests
 * 5. Cookie parser — required before any middleware that reads cookies
 * 6. Body parsers with size limits — prevent oversized payload DoS
 * 7. MongoDB query sanitization — strip NoSQL injection characters
 * 8. Trust proxy — correct client IP when behind nginx/load balancer
 * 9. CSRF: issue token cookie (always) + verify on state-changing requests
 * 10. API routes
 * 11. 404 handler — after all routes to catch unmatched paths
 * 12. Global error handler — must be last (4-arg signature)
 *
 * socket.io is initialized separately in server.ts using the HTTP server.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { securityHeaders } from './middleware/securityHeaders';
import { corsMiddleware } from './middleware/corsMiddleware';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { cspNonce } from './middleware/cspNonce';
import { stripServerHeaders } from './middleware/serverHeader';
import { issueCsrfToken, verifyCsrfToken } from './middleware/csrfProtection';
import routes from './routes/index';
import { logger } from './utils/logger';

/**
 * creates and configures the Express application.
 * exported as a factory function to allow multiple instances in tests.
 *
 * @returns configured Express Application instance
 */
export function createApp(): Application {
  const app = express();

  // disable Express fingerprint at the framework level; stripServerHeaders
  // middleware below enforces it on every response as defense-in-depth.
  app.disable('x-powered-by');

  // -----------------------------------------------------------------------
  // 1. strip server fingerprint headers (Server, X-Powered-By)
  // -----------------------------------------------------------------------
  app.use(stripServerHeaders);

  // -----------------------------------------------------------------------
  // 2. per-request CSP nonce — populates res.locals.cspNonce which is read
  //    by the helmet CSP directive functions. MUST run before helmet.
  // -----------------------------------------------------------------------
  app.use(cspNonce);

  // -----------------------------------------------------------------------
  // 3. security headers — helmet sets CSP, HSTS, X-Frame-Options, etc.
  // -----------------------------------------------------------------------
  app.use(securityHeaders);

  // -----------------------------------------------------------------------
  // 4. CORS — must be before route handlers to correctly handle
  //    OPTIONS preflight requests from browsers.
  // -----------------------------------------------------------------------
  app.use(corsMiddleware);

  // -----------------------------------------------------------------------
  // 5. cookie parser — parses Cookie header into req.cookies.
  //    required for httpOnly JWT cookie authentication and the XSRF cookie.
  // -----------------------------------------------------------------------
  app.use(cookieParser());

  // -----------------------------------------------------------------------
  // 6. body parsers — limit payload size to prevent DoS via large bodies.
  // -----------------------------------------------------------------------
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  // -----------------------------------------------------------------------
  // 7. MongoDB query sanitization — strips `$` and `.` from req.body/query/params.
  // -----------------------------------------------------------------------
  app.use(mongoSanitize());

  // -----------------------------------------------------------------------
  // 8. trust proxy — tells Express to trust X-Forwarded-For from first hop.
  // -----------------------------------------------------------------------
  app.set('trust proxy', 1);

  // -----------------------------------------------------------------------
  // 9. CSRF — always issue an XSRF-TOKEN cookie if one is missing, then
  //    verify the double-submit token on state-changing methods. Requests
  //    presenting a Bearer token are exempt (bearer auth is CSRF-immune).
  // -----------------------------------------------------------------------
  app.use(issueCsrfToken);
  app.use(verifyCsrfToken);

  // -----------------------------------------------------------------------
  // 10. API routes — all application routes mounted under /api
  // -----------------------------------------------------------------------
  app.use('/api', routes);

  // -----------------------------------------------------------------------
  // 10b. static frontend — when the React build is present, serve it from
  //     the same origin.
  // -----------------------------------------------------------------------
  const frontendBuildPath = path.resolve(__dirname, '..', '..', 'frontend', 'build');
  const frontendIndex = path.join(frontendBuildPath, 'index.html');

  if (fs.existsSync(frontendIndex)) {
    logger.info(`[app] Serving frontend build from ${frontendBuildPath}`);

    // read index.html once at startup; we do per-request nonce substitution
    // on the in-memory copy (far cheaper than fs.readFile per request).
    const indexTemplate = fs.readFileSync(frontendIndex, 'utf-8');

    // static assets — long cache for hashed files, no cache for the root
    // HTML (which we never actually serve from here — the SPA fallback
    // below always handles index.html so we can inject the nonce).
    app.use(
      express.static(frontendBuildPath, {
        index: false,
        maxAge: '1y',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      })
    );

    // SPA fallback — any non-/api GET that reaches here returns index.html
    // with the per-request CSP nonce injected.
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      const nonce = (res.locals['cspNonce'] as string | undefined) ?? '';
      const html = indexTemplate.split('__CSP_NONCE__').join(nonce);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    });
  } else {
    logger.info('[app] Frontend build not found — API-only mode');
  }

  // -----------------------------------------------------------------------
  // 11. 404 handler
  // -----------------------------------------------------------------------
  app.use(notFoundHandler);

  // -----------------------------------------------------------------------
  // 12. global error handler — MUST be the last middleware (4-arg signature).
  // -----------------------------------------------------------------------
  app.use(globalErrorHandler);

  logger.debug('[app] Express application configured');

  return app;
}
