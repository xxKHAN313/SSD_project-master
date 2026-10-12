/**
 * @fileoverview Application-wide constants.
 * Centralizes magic numbers and string literals used throughout the codebase.
 */

// user roles - must match the backend role enum exactly
export const ROLES = {
  EMPLOYEE: 'employee' as const,
  MANAGER: 'manager' as const,
  ADMIN: 'admin' as const,
};

// maximum allowed characters in a single chat message
export const MAX_MESSAGE_LENGTH = 1000;

// number of messages to load per page in the chat window
export const MESSAGES_PER_PAGE = 20;

// number of users to load per page in the admin user table
export const USERS_PER_PAGE = 20;

// number of audit log entries to load per page
export const LOGS_PER_PAGE = 25;

// milliseconds to wait after the user stops typing before emitting stop_typing
export const TYPING_TIMEOUT = 2000;

// milliseconds to debounce search input before making an api call
export const SEARCH_DEBOUNCE_MS = 400;

// maximum file size for any uploads (5mb in bytes)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// duration in milliseconds for toast auto-dismiss
export const TOAST_DURATION = 4000;

// minimum password length enforced on the client
export const MIN_PASSWORD_LENGTH = 8;

// maximum username length
export const MAX_USERNAME_LENGTH = 30;

// socket reconnection attempt limit before giving up
export const SOCKET_MAX_RECONNECT_ATTEMPTS = 5;

// route paths used across the application for navigation consistency
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password/:token',
  DASHBOARD: '/dashboard',
  CHAT: '/chat',
  ADMIN_USERS: '/admin/users',
  ADMIN_LOGS: '/admin/logs',
} as const;
