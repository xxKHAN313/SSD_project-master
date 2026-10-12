/**
 * errorMessages.ts
 *
 * all user-facing error messages are defined here as constants.
 * using generic messages prevents information disclosure:
 * - attackers cannot enumerate valid usernames/emails from login errors
 * - attackers cannot learn internal system details from error messages
 * - consistent messages reduce cognitive load for clients
 *
 * internal errors are logged with full detail; clients see only these messages.
 */

// authentication errors — kept generic to prevent user enumeration
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid credentials. Please check your username and password.',
  ACCOUNT_LOCKED:
    'Your account has been temporarily locked due to multiple failed login attempts. Please try again later.',
  ACCOUNT_INACTIVE: 'Your account is inactive. Please contact an administrator.',
  TOKEN_INVALID: 'Your session is invalid. Please log in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_MISSING: 'Authentication required. Please log in.',
  REFRESH_TOKEN_INVALID: 'Invalid session. Please log in again.',
  UNAUTHORIZED: 'Authentication required.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  LOGOUT_FAILED: 'Logout failed. Please try again.',
  ALREADY_LOGGED_OUT: 'Session already ended.',
} as const;

// registration errors
export const REGISTER_ERRORS = {
  USERNAME_TAKEN: 'This username is already in use.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  INVALID_EMAIL: 'Please provide a valid email address.',
  INVALID_USERNAME: 'Username must be 3-30 characters and contain only letters, numbers, and underscores.',
  WEAK_PASSWORD: 'Password does not meet the required complexity rules.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
} as const;

// password reset errors
export const PASSWORD_RESET_ERRORS = {
  // generic — don't reveal whether the email exists in the system
  EMAIL_NOT_FOUND: 'If an account with this email exists, a reset link has been sent.',
  TOKEN_INVALID: 'The password reset link is invalid or has expired. Please request a new one.',
  TOKEN_EXPIRED: 'The password reset link has expired. Please request a new one.',
  TOKEN_USED: 'This password reset link has already been used. Please request a new one.',
  PASSWORD_REUSED: 'You cannot reuse a recent password. Please choose a different password.',
  RESET_FAILED: 'Password reset failed. Please try again.',
  SAME_AS_CURRENT: 'New password must be different from your current password.',
} as const;

// user management errors
export const USER_ERRORS = {
  NOT_FOUND: 'User not found.',
  CANNOT_DELETE_SELF: 'You cannot delete your own account.',
  CANNOT_DEACTIVATE_SELF: 'You cannot deactivate your own account.',
  CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role.',
  INVALID_ROLE: 'The specified role is not valid.',
  UPDATE_FAILED: 'User update failed. Please try again.',
  CREATE_FAILED: 'User creation failed. Please try again.',
  DELETE_FAILED: 'User deletion failed. Please try again.',
} as const;

// messaging errors
export const CHAT_ERRORS = {
  ROOM_NOT_FOUND: 'Chat room not found.',
  MESSAGE_NOT_FOUND: 'Message not found.',
  MESSAGE_TOO_LONG: 'Message exceeds the maximum allowed length.',
  MESSAGE_EMPTY: 'Message cannot be empty.',
  ACCESS_DENIED: 'You do not have access to this chat room.',
  SEND_FAILED: 'Failed to send message. Please try again.',
  DELETE_FAILED: 'Failed to delete message. Please try again.',
  ROOM_CREATE_FAILED: 'Failed to create chat room. Please try again.',
} as const;

// validation errors
export const VALIDATION_ERRORS = {
  INVALID_INPUT: 'Invalid input. Please check your request.',
  MISSING_REQUIRED_FIELD: 'Required field is missing.',
  INVALID_ID: 'Invalid identifier format.',
  INVALID_DATE: 'Invalid date format.',
  INVALID_PAGINATION: 'Invalid pagination parameters.',
} as const;

// rate limiting errors
export const RATE_LIMIT_ERRORS = {
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down and try again later.',
  TOO_MANY_LOGIN_ATTEMPTS: 'Too many login attempts. Please wait 15 minutes before trying again.',
  TOO_MANY_MESSAGES: 'You are sending messages too quickly. Please wait before sending another.',
  TOO_MANY_RESET_REQUESTS: 'Too many password reset requests. Please wait before trying again.',
} as const;

// server errors — never expose internal details
export const SERVER_ERRORS = {
  INTERNAL: 'An unexpected error occurred. Please try again later.',
  DATABASE: 'A database error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
} as const;

// audit / not found
export const GENERAL_ERRORS = {
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'A conflict occurred with the existing data.',
  FORBIDDEN: 'Access to this resource is forbidden.',
} as const;

/**
 * maps mongodb error codes to user-friendly messages.
 * prevents leaking schema structure via duplicate key errors.
 */
export const MONGO_ERROR_MESSAGES: Record<number, string> = {
  11000: 'A record with this information already exists.', // duplicate key
  11001: 'A record with this information already exists.',
};
