/**
 * constants.ts (utils)
 *
 * application-wide runtime constants.
 * these are distinct from config/constants.ts which holds policy/enum values.
 * this file holds numeric limits, magic values, and flags used across the app.
 */

// maximum allowed message content length (characters)
export const MAX_MESSAGE_LENGTH = 1000;

// minimum message length (must not be empty or whitespace-only)
export const MIN_MESSAGE_LENGTH = 1;

// account lockout: number of consecutive failures before account is locked
export const MAX_LOGIN_ATTEMPTS = 5;

// lockout duration in milliseconds (30 minutes)
export const LOCKOUT_DURATION = 30 * 60 * 1000;

// password reset token validity in milliseconds (1 hour)
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

// session inactivity timeout in milliseconds (1 hour)
export const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// refresh token validity in milliseconds (7 days)
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// number of previous passwords to track for reuse prevention
export const PASSWORD_HISTORY_DEPTH = 5;

// default pagination settings
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// request body size limits
export const MAX_JSON_BODY_SIZE = '10kb'; // prevent large payload attacks

// audit log retention (not enforced in code but documented here)
export const AUDIT_LOG_RETENTION_DAYS = 90;

// rate limiting message socket events per user per window
export const SOCKET_MESSAGE_RATE_LIMIT = 10;
export const SOCKET_MESSAGE_RATE_WINDOW_MS = 60 * 1000;

// maximum number of rooms a user can be a member of simultaneously
export const MAX_ROOMS_PER_USER = 50;

// maximum room name length
export const MAX_ROOM_NAME_LENGTH = 100;

// maximum room description length
export const MAX_ROOM_DESCRIPTION_LENGTH = 500;

// search query minimum length (to avoid full collection scans)
export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 100;

// export formats for audit logs
export const EXPORT_FORMATS = ['csv', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// http header names used by the application
export const HEADERS = {
  CSRF_TOKEN: 'x-csrf-token',
  REQUEST_ID: 'x-request-id',
  REAL_IP: 'x-real-ip',
  FORWARDED_FOR: 'x-forwarded-for',
} as const;
