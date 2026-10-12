/**
 * constants.ts
 *
 * application-wide constants for roles, rate limits, token expiry,
 * password policy, lockout settings, and other security parameters.
 * centralizing these prevents magic numbers scattered across the codebase.
 */

// user roles — ordered from least to most privileged
export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// all valid role values as an array (useful for mongoose enum validation)
export const VALID_ROLES: UserRole[] = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN];

// rate limit configurations (all time values in milliseconds)
export const RATE_LIMITS = {
  // login endpoint: 5 attempts per 15 minutes per IP
  // prevents brute-force credential stuffing attacks
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
  },
  // general authenticated api: 100 requests per minute per user
  API_AUTH: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
  },
  // unauthenticated requests: 50 per minute per IP
  API_UNAUTH: {
    windowMs: 60 * 1000,
    max: 50,
  },
  // message sending: 10 messages per minute per user
  // prevents spam flooding
  MESSAGE: {
    windowMs: 60 * 1000,
    max: 10,
  },
  // read operations: 500 per minute per authenticated user
  READ: {
    windowMs: 60 * 1000,
    max: 500,
  },
  // password reset: 3 requests per hour per IP
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000,
    max: 3,
  },
} as const;

// jwt token expiry values
export const TOKEN_EXPIRY = {
  ACCESS: '1h',
  REFRESH: '7d',
  // password reset token TTL in milliseconds (1 hour)
  PASSWORD_RESET_MS: 60 * 60 * 1000,
} as const;

// session configuration
export const SESSION = {
  // session timeout after 1 hour of inactivity (in milliseconds)
  INACTIVITY_TIMEOUT_MS: 60 * 60 * 1000,
} as const;

// account lockout policy
export const LOCKOUT_POLICY = {
  // number of consecutive failed logins before lockout
  MAX_FAILED_ATTEMPTS: 5,
  // lockout duration in milliseconds (30 minutes)
  DURATION_MS: 30 * 60 * 1000,
} as const;

// password policy requirements
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  // maximum length to prevent DoS via bcrypt (bcrypt truncates at 72 bytes)
  MAX_LENGTH: 72,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  // number of previous passwords to track and prevent reuse
  HISTORY_DEPTH: 5,
  // regex pattern for special characters
  SPECIAL_CHARS_PATTERN: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
} as const;

// message constraints
export const MESSAGE_CONSTRAINTS = {
  MAX_LENGTH: 1000,
  MIN_LENGTH: 1,
} as const;

// username constraints
export const USERNAME_CONSTRAINTS = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  // only alphanumeric and underscores allowed
  PATTERN: /^[a-zA-Z0-9_]+$/,
} as const;

// pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// audit log severity levels
export const AUDIT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type AuditSeverity = (typeof AUDIT_SEVERITY)[keyof typeof AUDIT_SEVERITY];

// audit action types
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  ROOM_CREATED: 'ROOM_CREATED',
  RATE_LIMIT_BREACH: 'RATE_LIMIT_BREACH',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// http status codes (avoids magic numbers in controllers)
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;

// cookie configuration names
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token',
} as const;

// room access — which roles can access which room types
export const ROOM_ACCESS = {
  PUBLIC: [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN],
  MANAGER_ONLY: [ROLES.MANAGER, ROLES.ADMIN],
  ADMIN_ONLY: [ROLES.ADMIN],
} as const;
