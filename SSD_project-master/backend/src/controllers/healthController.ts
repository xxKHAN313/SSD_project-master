/**
 * healthController.ts
 *
 * system health check endpoint handler.
 * returns a snapshot of the application's operational status:
 * - overall status (ok / degraded)
 * - server uptime in seconds
 * - current timestamp (ISO 8601)
 * - database connectivity status
 *
 * this endpoint is public (no auth required) to allow load balancers
 * and monitoring systems to probe the service without credentials.
 * it deliberately avoids returning sensitive internal details.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { HTTP_STATUS } from '../config/constants';

/**
 * GET /api/health
 * returns the current health status of the application and its dependencies.
 * responds with 200 if all systems are operational, 503 if degraded.
 */
export function getHealthHandler(req: Request, res: Response): void {
  const dbReadyState = mongoose.connection.readyState;

  // mongoose readyState values:
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const databaseStatus = dbReadyState === 1 ? 'connected' : 'disconnected';
  const isDatabaseHealthy = dbReadyState === 1;

  const status = isDatabaseHealthy ? 'ok' : 'degraded';
  const httpStatus = isDatabaseHealthy ? HTTP_STATUS.OK : 503;

  res.status(httpStatus).json({
    success: isDatabaseHealthy,
    data: {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: databaseStatus,
      environment: process.env['NODE_ENV'] ?? 'development',
    },
  });
}
