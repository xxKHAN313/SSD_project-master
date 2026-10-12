/**
 * @fileoverview Generic API response and utility TypeScript interfaces.
 * Wraps all backend responses in a consistent envelope shape.
 */

// standard envelope wrapping all api responses - success or failure
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  // field-level validation errors keyed by field name
  errors?: Record<string, string>;
}

// query params for paginated list endpoints
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// structured error thrown by the api service layer
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  errors?: Record<string, string>;
}

// audit log entry returned from the audit service
export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  ipAddress: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'critical';
  details?: Record<string, unknown>;
  timestamp: string;
}

// filters passed to the audit logs endpoint
export interface AuditLogFilters extends PaginationParams {
  userId?: string;
  action?: string;
  severity?: 'info' | 'warning' | 'critical';
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
}

// paginated audit log response
export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
