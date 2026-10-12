/**
 * authRoutes.ts
 *
 * route definitions for /api/auth/* endpoints.
 * applies rate limiting and input validation before each handler.
 * public endpoints (register, login, forgot-password, reset-password) use
 * the unauthenticated rate limiter; protected endpoints require verifyToken.
 */

import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  getMeHandler,
  changePasswordHandler,
} from '../controllers/authController';
import { verifyToken } from '../middleware/authMiddleware';
import { validate } from '../middleware/validationMiddleware';
import {
  registerValidations,
  loginValidations,
  forgotPasswordValidations,
  resetPasswordValidations,
  changePasswordValidations,
} from '../validators/authValidator';
import {
  loginRateLimiter,
  unauthRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/auth/register
 * creates a new user account.
 * rate limited by IP to prevent mass account creation.
 */
router.post(
  '/register',
  unauthRateLimiter,
  validate(registerValidations),
  registerHandler
);

/**
 * POST /api/auth/login
 * authenticates a user and issues access + refresh tokens.
 * rate limited tightly by IP to prevent credential brute-force.
 */
router.post(
  '/login',
  loginRateLimiter,
  validate(loginValidations),
  loginHandler
);

/**
 * POST /api/auth/logout
 * revokes the current session and clears auth cookies.
 * requires a valid access token.
 */
router.post('/logout', verifyToken, logoutHandler);

/**
 * POST /api/auth/refresh
 * exchanges a valid refresh token (from httpOnly cookie) for a new token pair.
 * no access token required — the refresh token in the cookie is the credential.
 */
router.post('/refresh', refreshHandler);

/**
 * POST /api/auth/forgot-password
 * initiates the password reset flow by sending an email.
 * rate limited strictly to prevent email bombing.
 * always returns 200 regardless of whether the email exists (anti-enumeration).
 */
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate(forgotPasswordValidations),
  forgotPasswordHandler
);

/**
 * POST /api/auth/reset-password
 * completes the password reset with a valid one-time token.
 * rate limited to prevent token brute-force.
 */
router.post(
  '/reset-password',
  unauthRateLimiter,
  validate(resetPasswordValidations),
  resetPasswordHandler
);

/**
 * GET /api/auth/me
 * returns the authenticated user's own profile.
 * requires a valid access token.
 */
router.get('/me', verifyToken, getMeHandler);

/**
 * POST /api/auth/change-password
 * lets the authenticated user change their own password.
 * requires re-authentication with the current password.
 * rate limited via the password-reset limiter to slow down abuse.
 */
router.post(
  '/change-password',
  verifyToken,
  passwordResetRateLimiter,
  validate(changePasswordValidations),
  changePasswordHandler
);

export default router;
