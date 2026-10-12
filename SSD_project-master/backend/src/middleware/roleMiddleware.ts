/**
 * roleMiddleware.ts
 *
 * role-based access control (RBAC) middleware factory.
 * implements "default deny" — access is only granted if the user's role
 * is explicitly listed in the allowed roles array.
 * unauthorized access attempts are logged to the audit trail.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole, HTTP_STATUS, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../config/constants';
import { AUTH_ERRORS } from '../utils/errorMessages';
import { createLog } from '../services/auditService';
import { logger } from '../utils/logger';

/**
 * factory function that creates role-checking middleware.
 * usage: router.get('/admin', verifyToken, requireRole('admin'), handler)
 *
 * the returned middleware:
 * 1. checks that req.user is populated (verifyToken must run first)
 * 2. checks that req.user.role is in the allowedRoles list
 * 3. returns 403 with a generic message on failure
 * 4. logs unauthorized access attempts to the audit log
 *
 * @param allowedRoles - one or more roles that are permitted to access the endpoint
 * @returns express middleware function
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // verifyToken must run before this middleware
    // if req.user is missing, return 401 (not 403)
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.UNAUTHORIZED,
      });
      return;
    }

    const { userId, role, username } = req.user;

    // check if user's role is in the allowed list
    if (!allowedRoles.includes(role)) {
      logger.warn('[roleMiddleware] unauthorized access attempt', {
        userId,
        username,
        userRole: role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
      });

      // audit log the unauthorized access attempt
      // this is fire-and-forget — do not await (avoid blocking the response)
      createLog({
        userId,
        username,
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
        details: {
          path: req.path,
          method: req.method,
          userRole: role,
          requiredRoles: allowedRoles,
        },
        severity: AUDIT_SEVERITY.WARNING,
        req,
        success: false,
      }).catch(() => {
        // audit failure should not affect the response
      });

      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS,
      });
      return;
    }

    next();
  };
}

/**
 * middleware that requires the user to be at least a manager.
 * convenience wrapper around requireRole.
 */
export const requireManager = requireRole('manager', 'admin');

/**
 * middleware that requires the user to be an admin.
 * convenience wrapper around requireRole.
 */
export const requireAdmin = requireRole('admin');

/**
 * middleware that allows any authenticated user.
 * used for endpoints accessible to all roles.
 * NOTE: verifyToken must still run before this — it only checks auth, not role.
 */
export function requireAnyRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: AUTH_ERRORS.UNAUTHORIZED,
    });
    return;
  }
  next();
}
