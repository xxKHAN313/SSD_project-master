/**
 * authController.ts
 *
 * HTTP request handlers for authentication endpoints.
 * delegates business logic to authService.
 * sets httpOnly cookies for tokens on login/register/refresh.
 * returns generic error messages — never internal details.
 */

import { Request, Response, NextFunction } from 'express';
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshAuthTokens,
  getMe,
  changePassword,
} from '../services/authService';
import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  CLEAR_ACCESS_TOKEN_OPTIONS,
  CLEAR_REFRESH_TOKEN_OPTIONS,
} from '../config/security';
import { COOKIE_NAMES, HTTP_STATUS } from '../config/constants';
import { AUTH_ERRORS } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * POST /api/auth/register
 * creates a new user account and returns auth tokens.
 * tokens are set as httpOnly cookies AND returned in the response body
 * to support both browser and API clients.
 */
export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await register(req.body, req);

    // set access token as httpOnly cookie
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    // set refresh token in a path-restricted httpOnly cookie
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: result.user,
        accessToken: result.accessToken, // also in body for API clients
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * authenticates a user and returns auth tokens.
 * uses the same cookie pattern as register.
 */
export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await login(req.body, req);

    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * revokes the current session and clears auth cookies.
 */
export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;

    if (userId && refreshToken) {
      await logout(userId, refreshToken, req);
    }

    // clear cookies regardless of whether revocation succeeded
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, CLEAR_ACCESS_TOKEN_OPTIONS);
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, CLEAR_REFRESH_TOKEN_OPTIONS);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * exchanges a valid refresh token for a new token pair (token rotation).
 * reads the refresh token from the httpOnly cookie.
 */
export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;

    if (!refreshToken) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.REFRESH_TOKEN_INVALID,
      });
      return;
    }

    const result = await refreshAuthTokens(refreshToken, req);

    if (!result) {
      // clear invalid cookies
      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, CLEAR_ACCESS_TOKEN_OPTIONS);
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, CLEAR_REFRESH_TOKEN_OPTIONS);

      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: AUTH_ERRORS.REFRESH_TOKEN_INVALID,
      });
      return;
    }

    // set the new tokens as cookies
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/forgot-password
 * initiates a password reset flow.
 * always returns 200 to prevent user enumeration.
 */
export async function forgotPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;
    await forgotPassword(email, req);

    // always return the same message regardless of whether the email was found
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password
 * completes the password reset flow with a valid token.
 */
export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password
 * allows the authenticated user to change their own password.
 * requires the current password for re-authentication.
 * revokes all active sessions on success.
 */
export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    await changePassword(userId, currentPassword, newPassword, req);

    // clear cookies so the client must log in with the new password
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, CLEAR_ACCESS_TOKEN_OPTIONS);
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, CLEAR_REFRESH_TOKEN_OPTIONS);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * returns the authenticated user's profile.
 * requires a valid access token (handled by verifyToken middleware).
 */
export async function getMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId; // verifyToken middleware guarantees this
    const profile = await getMe(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { user: profile },
    });
  } catch (error) {
    next(error);
  }
}
