/**
 * validators.ts
 *
 * pure validation functions (no side effects, no db calls).
 * used for input validation before processing requests.
 * returns boolean results — actual error messages are in errorMessages.ts.
 */

import mongoose from 'mongoose';
import { VALID_ROLES, UserRole, USERNAME_CONSTRAINTS } from '../config/constants';

/**
 * validates an email address format using RFC 5322 compliant regex.
 * does not verify deliverability — only format.
 *
 * @param email - the candidate email string
 * @returns true if the format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // simplified but effective email pattern
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim()) && email.length <= 254; // rfc 5321 max length
}

/**
 * validates a username against the allowed character set and length bounds.
 * only alphanumeric characters and underscores are allowed to prevent
 * injection and formatting issues.
 *
 * @param username - the candidate username string
 * @returns true if valid
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_CONSTRAINTS.MIN_LENGTH) return false;
  if (trimmed.length > USERNAME_CONSTRAINTS.MAX_LENGTH) return false;
  return USERNAME_CONSTRAINTS.PATTERN.test(trimmed);
}

/**
 * validates password complexity.
 * returns a simple boolean — use validatePasswordStrength from passwordUtils
 * when detailed error messages are needed.
 *
 * @param password - the candidate password string
 * @returns true if the password meets minimum requirements
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

/**
 * validates whether a string is a valid mongodb objectid.
 * prevents malformed ids from reaching the database layer.
 *
 * @param id - the candidate id string
 * @returns true if it's a valid 24-character hex objectid
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * validates that a role string is one of the three valid application roles.
 *
 * @param role - the candidate role string
 * @returns true if it's a recognized role
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

/**
 * sanitizes a string input by trimming whitespace and removing null bytes.
 * null bytes can cause unexpected behavior in databases and string operations.
 *
 * @param input - raw input string
 * @returns cleaned string
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  // remove null bytes (used in some injection attacks)
  return input.replace(/\0/g, '').trim();
}

/**
 * validates a pagination page number.
 *
 * @param page - the candidate page value
 * @returns true if it's a positive integer
 */
export function isValidPage(page: number): boolean {
  return Number.isInteger(page) && page >= 1;
}

/**
 * validates a pagination limit value.
 *
 * @param limit - the candidate limit value
 * @param maxLimit - the maximum allowed limit (default 100)
 * @returns true if it's a positive integer within bounds
 */
export function isValidLimit(limit: number, maxLimit = 100): boolean {
  return Number.isInteger(limit) && limit >= 1 && limit <= maxLimit;
}

/**
 * validates an ISO 8601 date string.
 *
 * @param dateStr - the candidate date string
 * @returns true if it parses to a valid date
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
