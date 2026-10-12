/**
 * authMiddleware.ts
 *
 * JWT authentication middleware.
 * extracts and verifies the access token from either:
 * 1. the Authorization: Bearer <token> header (preferred for API clients)
 * 2. the access_token httpOnly cookie (preferred for browser clients)
 *
 * attaches the decoded user payload to req.user on success.
 * returns 401 with a generic message on any failure.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractBearerToken } from '../utils/tokenUtils';
import { User } from '../models/User';
import { UserRole } from '../config/constants';
import { COOKIE_NAMES, HTTP_STATUS } from '../config/constants';
import { AUTH_ERRORS } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * extends the Express Request interface to include the authenticated user.
 * this augmentation allows controllers to access req.user safely.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        username: string;
      };
    }
  }
}

/**
 * authentication middleware.
 * verifies the JWT access token and populates req.user.
 * rejects with 401 if token is missing, expired, or invalid.
 * also verifies the user still exists and is active in the database —
 * this catches cases where the account was deleted or deactivated after token issuance.
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // try Authorization header first, then fall back to cookie
    const authHeader = req.headers['authorization'];
    const bearerToken = extractBearerToken(authHeader);
    const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined;

    const token = bearerToken ?? cookieToken;

    if (!token) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.TOKEN_MISSING,
      });
      return;
    }

    // verify signature, expiry, issuer, audience
    const decoded = verifyAccessToken(token);

    // verify the user still exists and is active in the database
    // this is an additional DB call but prevents stale tokens from working
    // after account deletion or deactivation
    const user = await User.findById(decoded.userId).select('username role isActive').lean();

    if (!user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.TOKEN_INVALID,
      });
      return;
    }

    if (!user.isActive) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.ACCOUNT_INACTIVE,
      });
      return;
    }

    // attach user to request for downstream middleware and controllers
    req.user = {
      userId: decoded.userId,
      role: user.role, // use DB role (not token role) to reflect any role changes
      username: user.username,
    };

    next();
  } catch (error) {
    const err = error as Error;
    const isExpired = err.name === 'TokenExpiredError';

    // log at debug level — token expiry is routine, not an attack
    logger.debug('[authMiddleware] token verification failed', {
      error: err.name,
      path: req.path,
    });

    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: isExpired ? AUTH_ERRORS.TOKEN_EXPIRED : AUTH_ERRORS.TOKEN_INVALID,
    });
  }
}

/**
 * optional authentication middleware.
 * like verifyToken but does not block unauthenticated requests.
 * populates req.user if a valid token is present; leaves it undefined otherwise.
 * useful for endpoints that have both authenticated and unauthenticated behavior.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const bearerToken = extractBearerToken(authHeader);
    const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined;
    const token = bearerToken ?? cookieToken;

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select('username role isActive').lean();

      if (user && user.isActive) {
        req.user = {
          userId: decoded.userId,
          role: user.role,
          username: user.username,
        };
      }
    }
  } catch {
    // silently ignore auth errors in optional auth mode
  }
  next();
}
