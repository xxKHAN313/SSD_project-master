/**
 * errorHandler.ts
 *
 * global Express error handling middleware.
 * catches all errors propagated via next(error) and returns
 * safe, generic error responses to clients.
 *
 * critical security principle: never send stack traces or internal
 * error details to clients — this prevents information disclosure
 * that could aid attackers in understanding the system internals.
 * all internal details are logged via winston for server-side debugging.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { HTTP_STATUS } from '../config/constants';
import { SERVER_ERRORS, MONGO_ERROR_MESSAGES } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * interface for errors that include an HTTP status code.
 * controllers can attach statusCode to errors for semantic responses.
 */
interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
  code?: number | string; // mongodb error code
  keyPattern?: Record<string, number>; // mongoose duplicate key info
}

/**
 * 404 handler for unmatched routes.
 * must be registered AFTER all route definitions.
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.debug('[errorHandler] route not found', { path: req.path, method: req.method });
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'The requested resource was not found.',
  });
}

/**
 * global error handler middleware.
 * express identifies this as an error handler via the 4-argument signature.
 * must be registered LAST in the middleware chain.
 *
 * handles:
 * - application errors (with statusCode property)
 * - mongoose validation errors (400)
 * - mongoose duplicate key errors (409)
 * - mongoose cast errors / invalid ObjectId (400)
 * - JWT errors (handled upstream in authMiddleware, but caught here as fallback)
 * - unknown errors (500)
 */
export function globalErrorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // always log the full error internally for debugging
  logger.error('[errorHandler] unhandled error', {
    message: err.message,
    name: err.name,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    statusCode: err.statusCode,
  });

  // ---- mongoose validation error ----
  // triggered when schema validation fails (e.g., required field missing)
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid input data. Please check your request.',
    });
    return;
  }

  // ---- mongoose cast error ----
  // triggered when an invalid value is cast (e.g., bad ObjectId format)
  if (err instanceof mongoose.Error.CastError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid identifier format.',
    });
    return;
  }

  // ---- mongodb duplicate key error ----
  // error code 11000 = duplicate key constraint violation
  if (err.code === 11000 || err.code === 11001) {
    res.status(HTTP_STATUS.CONFLICT).json({
      success: false,
      message: MONGO_ERROR_MESSAGES[11000],
    });
    return;
  }

  // ---- application error with explicit status code ----
  // thrown by service/controller layer with attached statusCode
  if (err.statusCode) {
    const statusCode = err.statusCode;
    res.status(statusCode).json({
      success: false,
      message: err.message, // app errors use safe messages from errorMessages.ts
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // ---- jwt errors (fallback — normally caught in authMiddleware) ----
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication failed. Please log in again.',
    });
    return;
  }

  // ---- payload too large ----
  if (err.name === 'PayloadTooLargeError') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Request payload is too large.',
    });
    return;
  }

  // ---- default: internal server error ----
  // generic 500 — never expose err.message or stack to client
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    message: SERVER_ERRORS.INTERNAL,
  });
}
