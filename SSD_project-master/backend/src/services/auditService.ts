/**
 * auditService.ts
 *
 * creates and retrieves security audit log entries.
 * every authentication event, role change, admin action, and security violation
 * must generate an audit entry through this service.
 * audit logs are immutable — no update or delete operations are provided.
 */

import { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLog, IAuditLog, AuditLogFilters } from '../models/AuditLog';
import { AuditAction, AuditSeverity, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../config/constants';
import { logger } from '../utils/logger';
import { PAGINATION } from '../config/constants';

/**
 * parameters for creating an audit log entry.
 */
export interface CreateLogParams {
  userId?: string | null;
  username?: string | null;
  action: AuditAction;
  targetId?: string | null;
  targetType?: string | null;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
  success?: boolean;
  req?: Request;
  // allow direct ip/ua override (e.g., for socket events)
  ipAddress?: string;
  userAgent?: string;
}

/**
 * maps audit actions to their default severity levels.
 * critical events trigger immediate attention; info events are routine.
 */
const ACTION_SEVERITY_MAP: Partial<Record<AuditAction, AuditSeverity>> = {
  [AUDIT_ACTIONS.LOGIN_FAILURE]: AUDIT_SEVERITY.WARNING,
  [AUDIT_ACTIONS.ACCOUNT_LOCKED]: AUDIT_SEVERITY.CRITICAL,
  [AUDIT_ACTIONS.UNAUTHORIZED_ACCESS]: AUDIT_SEVERITY.WARNING,
  [AUDIT_ACTIONS.RATE_LIMIT_BREACH]: AUDIT_SEVERITY.WARNING,
  [AUDIT_ACTIONS.ROLE_CHANGE]: AUDIT_SEVERITY.CRITICAL,
  [AUDIT_ACTIONS.USER_DELETED]: AUDIT_SEVERITY.CRITICAL,
  [AUDIT_ACTIONS.USER_DEACTIVATED]: AUDIT_SEVERITY.WARNING,
  [AUDIT_ACTIONS.PASSWORD_RESET_REQUEST]: AUDIT_SEVERITY.INFO,
  [AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS]: AUDIT_SEVERITY.INFO,
  [AUDIT_ACTIONS.MESSAGE_DELETED]: AUDIT_SEVERITY.INFO,
};

/**
 * extracts the client IP address from an express request.
 * checks X-Forwarded-For header first (for proxied requests),
 * falling back to the direct connection remote address.
 * the rightmost IP in X-Forwarded-For is the most trustworthy.
 */
function extractIpAddress(req?: Request): string {
  if (!req) return 'unknown';

  // x-forwarded-for may contain a chain of IPs (client, proxy1, proxy2)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0];
    return (ips ?? '').trim() || 'unknown';
  }

  return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
}

/**
 * extracts the user-agent string from an express request.
 */
function extractUserAgent(req?: Request): string {
  if (!req) return 'unknown';
  const ua = req.headers['user-agent'];
  if (!ua) return 'unknown';
  // truncate very long user agents to prevent DB bloat
  return ua.substring(0, 500);
}

/**
 * creates an audit log entry.
 * errors in audit logging are caught and logged internally —
 * they must NOT propagate and disrupt the main application flow.
 * an audit failure should not prevent a login from completing.
 *
 * @param params - the audit log parameters
 */
export async function createLog(params: CreateLogParams): Promise<void> {
  try {
    const severity =
      params.severity ??
      ACTION_SEVERITY_MAP[params.action] ??
      AUDIT_SEVERITY.INFO;

    const ipAddress = params.ipAddress ?? extractIpAddress(params.req);
    const userAgent = params.userAgent ?? extractUserAgent(params.req);

    const entry = new AuditLog({
      userId: params.userId ? new mongoose.Types.ObjectId(params.userId) : null,
      username: params.username ?? null,
      action: params.action,
      targetId: params.targetId ?? null,
      targetType: params.targetType ?? null,
      ipAddress,
      userAgent,
      details: params.details ?? {},
      severity,
      success: params.success ?? true,
    });

    await entry.save();
  } catch (error) {
    // log to winston but do not throw — audit failures are non-fatal
    logger.error('[auditService] failed to create audit log entry', {
      action: params.action,
      error: (error as Error).message,
    });
  }
}

/**
 * retrieves paginated audit logs with optional filters.
 *
 * @param filters - search/filter criteria
 * @param page - page number (1-indexed)
 * @param limit - items per page
 * @returns paginated result with logs and total count
 */
export async function getLogs(
  filters: AuditLogFilters,
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
): Promise<{ logs: IAuditLog[]; total: number; page: number; totalPages: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), PAGINATION.MAX_LIMIT);

  const { logs, total } = await AuditLog.findByFilters(filters, safePage, safeLimit);
  const totalPages = Math.ceil(total / safeLimit);

  return { logs, total, page: safePage, totalPages };
}

/**
 * exports audit logs as a formatted CSV string.
 * used by the admin audit export endpoint.
 *
 * @param filters - search/filter criteria
 * @returns CSV string with header row and data rows
 */
export async function exportLogsAsCsv(filters: AuditLogFilters): Promise<string> {
  // fetch all matching logs (no pagination for export)
  const { logs } = await AuditLog.findByFilters(filters, 1, 10000);

  const header = [
    'Timestamp',
    'Username',
    'Action',
    'Success',
    'Severity',
    'IP Address',
    'Target ID',
    'Target Type',
    'Details',
  ].join(',');

  const rows = logs.map((log) => {
    const details = JSON.stringify(log.details ?? {}).replace(/,/g, ';');
    return [
      new Date(log.createdAt).toISOString(),
      escapeCsvField(log.username ?? ''),
      log.action,
      log.success ? 'true' : 'false',
      log.severity,
      escapeCsvField(log.ipAddress),
      escapeCsvField(log.targetId ?? ''),
      escapeCsvField(log.targetType ?? ''),
      escapeCsvField(details),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * exports audit logs as a JSON array string.
 *
 * @param filters - search/filter criteria
 * @returns JSON array string of log entries
 */
export async function exportLogsAsJson(filters: AuditLogFilters): Promise<string> {
  const { logs } = await AuditLog.findByFilters(filters, 1, 10000);
  return JSON.stringify(logs, null, 2);
}

/**
 * escapes a value for safe CSV inclusion.
 * wraps in double quotes and escapes internal double quotes.
 */
function escapeCsvField(value: string): string {
  if (!value) return '""';
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
