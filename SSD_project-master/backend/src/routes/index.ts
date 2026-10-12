/**
 * routes/index.ts
 *
 * central route aggregator.
 * mounts all sub-routers under the /api prefix.
 * the health check endpoint is available without authentication
 * to allow infrastructure monitoring and load balancer probes.
 */

import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import chatRoutes from './chatRoutes';
import auditRoutes from './auditRoutes';
import { getHealthHandler } from '../controllers/healthController';
import { unauthRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/health
 * public health check — no authentication required.
 * returns application status, uptime, and database connectivity.
 */
router.get('/health', unauthRateLimiter, getHealthHandler);

/**
 * /api/auth/* — registration, login, logout, token refresh, password reset
 */
router.use('/auth', authRoutes);

/**
 * /api/users/* — user management (admin only)
 */
router.use('/users', userRoutes);

/**
 * /api/chat/* — chat rooms and messages (all authenticated users)
 */
router.use('/chat', chatRoutes);

/**
 * /api/audit/* — audit log viewing and export (admin only)
 */
router.use('/audit', auditRoutes);

export default router;
