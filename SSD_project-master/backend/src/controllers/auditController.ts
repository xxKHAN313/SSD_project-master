/**
 * auditController.ts
 *
 * HTTP request handlers for audit log viewing and export (admin only).
 * supports filtering by action, severity, userId, date range, and free-text search.
 * export supports both CSV and JSON formats as file attachments.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { HTTP_STATUS, PAGINATION, AUDIT_ACTIONS, AUDIT_SEVERITY } from '../config/constants';
import type { AuditAction, AuditSeverity } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * builds a mongoose filter query from the request query parameters.
 * shared between getAuditLogsHandler and exportAuditLogsHandler.
 */
function buildAuditQuery(query: Request['query']): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // filter by action — must be a valid AUDIT_ACTIONS value
  if (query['action']) {
    const action = query['action'] as string;
    const validActions = Object.values(AUDIT_ACTIONS) as string[];
    if (validActions.includes(action)) {
      filter['action'] = action as AuditAction;
    }
  }

  // filter by severity level
  if (query['severity']) {
    const severity = query['severity'] as string;
    const validSeverities = Object.values(AUDIT_SEVERITY) as string[];
    if (validSeverities.includes(severity)) {
      filter['severity'] = severity as AuditSeverity;
    }
  }

  // filter by userId — validate ObjectId format before querying
  if (query['userId']) {
    const userId = query['userId'] as string;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      filter['userId'] = new mongoose.Types.ObjectId(userId);
    }
  }

  // filter by success flag
  if (query['success'] !== undefined) {
    filter['success'] = query['success'] === 'true';
  }

  // date range filter — createdAt between startDate and endDate
  const dateFilter: Record<string, Date> = {};
  if (query['startDate']) {
    const startDate = new Date(query['startDate'] as string);
    if (!isNaN(startDate.getTime())) {
      dateFilter['$gte'] = startDate;
    }
  }
  if (query['endDate']) {
    const endDate = new Date(query['endDate'] as string);
    if (!isNaN(endDate.getTime())) {
      dateFilter['$lte'] = endDate;
    }
  }
  if (Object.keys(dateFilter).length > 0) {
    filter['createdAt'] = dateFilter;
  }

  // free-text search on username or ipAddress fields
  if (query['search']) {
    const escaped = (query['search'] as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter['$or'] = [
      { username: { $regex: escaped, $options: 'i' } },
      { ipAddress: { $regex: escaped, $options: 'i' } },
    ];
  }

  return filter;
}

/**
 * GET /api/audit/logs
 * returns paginated audit log entries with optional filtering.
 * query params: page, limit, action, severity, userId, startDate, endDate, search, success
 */
export async function getAuditLogsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(
      1,
      parseInt((req.query['page'] as string) ?? '1', 10) || PAGINATION.DEFAULT_PAGE
    );
    const limit = Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10) || PAGINATION.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    const filter = buildAuditQuery(req.query);

    const [rawLogs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    // transform lean documents: _id → id (string), createdAt → timestamp (ISO string)
    const logs = rawLogs.map((log) => ({
      ...log,
      id: (log._id as mongoose.Types.ObjectId).toString(),
      timestamp: (log.createdAt as Date).toISOString(),
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        logs,
        total,
        page,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/audit/logs/export?format=csv|json
 * exports audit logs as a downloadable file attachment.
 * applies the same filters as getAuditLogsHandler.
 * capped at 10,000 records to prevent excessively large exports.
 * supports format=csv (default) and format=json.
 */
export async function exportAuditLogsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const format = ((req.query['format'] as string) ?? 'csv').toLowerCase();
    if (format !== 'csv' && format !== 'json') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Export format must be "csv" or "json".',
      });
      return;
    }

    const filter = buildAuditQuery(req.query);

    // cap at 10,000 records to prevent memory/timeout issues
    const MAX_EXPORT_RECORDS = 10000;
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_RECORDS)
      .lean()
      .exec();

    logger.info('[auditController] audit log export requested', {
      userId: req.user?.userId,
      format,
      recordCount: logs.length,
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
      res.status(HTTP_STATUS.OK).json(logs);
      return;
    }

    // CSV export — build header row and data rows
    const csvColumns = [
      '_id',
      'userId',
      'username',
      'action',
      'targetId',
      'targetType',
      'severity',
      'success',
      'ipAddress',
      'userAgent',
      'createdAt',
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // wrap in double quotes if the value contains commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerRow = csvColumns.join(',');
    const dataRows = logs.map((log) => {
      return csvColumns
        .map((col) => escapeCSV((log as unknown as Record<string, unknown>)[col]))
        .join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.status(HTTP_STATUS.OK).send(csvContent);
  } catch (error) {
    next(error);
  }
}
