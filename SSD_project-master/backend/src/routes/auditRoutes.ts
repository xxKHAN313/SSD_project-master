/**
 * auditRoutes.ts
 *
 * route definitions for /api/audit/* endpoints.
 * all routes require authentication + rate limiting.
 * per-route role checks:
 *   - /logs/export : manager + admin (managers may export message history for audits)
 *   - /logs        : admin only (full audit log viewer)
 * the export route must be declared BEFORE the parameterized logs route
 * so that /logs/export is not matched as /logs/:id.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { requireAdmin, requireManager } from '../middleware/roleMiddleware';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { getAuditLogsHandler, exportAuditLogsHandler } from '../controllers/auditController';

const router = Router();

// all audit routes require authentication + rate limiting
router.use(verifyToken, apiRateLimiter);

/**
 * GET /api/audit/logs/export
 * exports audit / message history logs as a downloadable file (CSV or JSON).
 * accessible to managers and admins — managers need this for audit exports
 * per the role requirement matrix.
 * query params: format (csv|json), plus all filter params from /logs.
 * must be registered before /logs to prevent route shadowing.
 */
router.get('/logs/export', requireManager, exportAuditLogsHandler);

/**
 * GET /api/audit/logs
 * returns paginated audit log entries with optional filtering.
 * admin only — managers do not have the full log viewer.
 * query params: page, limit, action, severity, userId, startDate, endDate, search, success
 */
router.get('/logs', requireAdmin, getAuditLogsHandler);

export default router;
