/**
 * corsMiddleware.ts
 *
 * CORS configuration middleware.
 * restricts cross-origin requests to whitelisted origins only.
 * credentials (cookies) are allowed for whitelisted origins.
 */

import cors from 'cors';
import { CORS_OPTIONS } from '../config/security';

/**
 * configured cors middleware instance.
 * applies the whitelist-based origin checking from security.ts.
 * use this as the first middleware in the chain to handle OPTIONS preflight.
 */
export const corsMiddleware = cors(CORS_OPTIONS);
