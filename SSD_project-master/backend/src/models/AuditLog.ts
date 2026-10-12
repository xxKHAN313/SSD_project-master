/**
 * AuditLog.ts
 *
 * mongoose schema for the security audit log.
 * all authentication events, role changes, admin actions, and failed
 * access attempts are recorded here for compliance and forensic analysis.
 * audit logs are append-only — they are never updated or deleted.
 * indexes are tuned for the primary query patterns: by user, action, and time range.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { AUDIT_ACTIONS, AuditAction, AUDIT_SEVERITY, AuditSeverity } from '../config/constants';

/**
 * interface for an audit log document.
 */
export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  // userId may be null for unauthenticated events (e.g., failed login by unknown user)
  userId: mongoose.Types.ObjectId | null;
  // human-readable username snapshot (stored separately in case user is deleted later)
  username: string | null;
  action: AuditAction;
  // the affected resource id (e.g., target user id, message id, room id)
  targetId: string | null;
  // the type of the target resource
  targetType: string | null;
  ipAddress: string;
  userAgent: string;
  // additional context as key-value pairs
  details: Record<string, unknown>;
  severity: AuditSeverity;
  // success/failure flag for relevant actions
  success: boolean;
  createdAt: Date;
}

export interface IAuditLogModel extends Model<IAuditLog> {
  findByFilters(filters: AuditLogFilters, page: number, limit: number): Promise<{
    logs: IAuditLog[];
    total: number;
  }>;
}

export interface AuditLogFilters {
  userId?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  success?: boolean;
}

const auditLogSchema = new Schema<IAuditLog, IAuditLogModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    username: {
      type: String,
      default: null,
    },

    action: {
      type: String,
      enum: {
        values: Object.values(AUDIT_ACTIONS),
        message: 'Invalid audit action type',
      },
      required: [true, 'Audit action is required'],
      index: true,
    },

    targetId: {
      type: String,
      default: null,
    },

    targetType: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      // store as string — supports both IPv4 and IPv6
    },

    userAgent: {
      type: String,
      default: 'unknown',
      maxlength: 500,
    },

    details: {
      type: Schema.Types.Mixed,
      default: {},
    },

    severity: {
      type: String,
      enum: {
        values: Object.values(AUDIT_SEVERITY),
        message: 'Invalid severity level',
      },
      default: AUDIT_SEVERITY.INFO,
      index: true,
    },

    success: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    // only createdAt — audit logs are immutable, no updatedAt
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    // disable mongoose update timestamps on this collection
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// primary time-series index — most queries filter by time range
auditLogSchema.index({ createdAt: -1 });

// compound index for user + action + time (most common audit query pattern)
auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

// compound index for security monitoring — failed events by ip
auditLogSchema.index({ ipAddress: 1, success: 1, createdAt: -1 });

// compound index for severity-based alerting queries
auditLogSchema.index({ severity: 1, createdAt: -1 });

/**
 * static method: retrieves paginated audit logs with optional filters.
 * supports filtering by userId, action, severity, date range, ip, and success status.
 */
auditLogSchema.statics.findByFilters = async function (
  filters: AuditLogFilters,
  page: number,
  limit: number
): Promise<{ logs: IAuditLog[]; total: number }> {
  const query: Record<string, unknown> = {};

  if (filters.userId) query['userId'] = new mongoose.Types.ObjectId(filters.userId);
  if (filters.action) query['action'] = filters.action;
  if (filters.severity) query['severity'] = filters.severity;
  if (filters.ipAddress) query['ipAddress'] = filters.ipAddress;
  if (typeof filters.success === 'boolean') query['success'] = filters.success;

  // date range filter — createdAt must fall within [startDate, endDate]
  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter['$gte'] = filters.startDate;
    if (filters.endDate) dateFilter['$lte'] = filters.endDate;
    query['createdAt'] = dateFilter;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    this.countDocuments(query),
  ]);

  return { logs, total };
};

export const AuditLog = mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema);
