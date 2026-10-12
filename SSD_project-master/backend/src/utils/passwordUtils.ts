/**
 * passwordUtils.ts
 *
 * password hashing, comparison, strength validation, and history checking.
 * all password operations go through bcrypt with 12 salt rounds.
 * strength validation enforces the password policy defined in constants.ts.
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { BCRYPT_ROUNDS } from '../config/security';
import { PASSWORD_POLICY } from '../config/constants';
import { logger } from './logger';

/**
 * result of password strength validation.
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * hashes a password using bcrypt with the configured number of salt rounds.
 * bcrypt automatically handles salt generation — no separate salt needed.
 * the cost factor (12 rounds) slows down brute-force attacks significantly.
 *
 * @param plainPassword - the raw password string
 * @returns bcrypt hash string (includes algorithm, rounds, salt, hash)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword) {
    throw new Error('[passwordUtils] cannot hash empty password');
  }
  // bcrypt silently truncates at 72 bytes — validate length before hashing
  if (Buffer.byteLength(plainPassword, 'utf8') > PASSWORD_POLICY.MAX_LENGTH) {
    throw new Error('[passwordUtils] password exceeds maximum byte length');
  }
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * securely compares a plaintext password against a bcrypt hash.
 * uses bcrypt's timing-safe comparison to prevent timing attacks.
 * always returns false (not throws) on error to prevent oracle attacks.
 *
 * @param plainPassword - the raw password to check
 * @param hash - the stored bcrypt hash
 * @returns true if the password matches, false otherwise
 */
export async function comparePassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || !hash) return false;
  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch (error) {
    logger.error('[passwordUtils] error comparing password', { error: (error as Error).message });
    return false;
  }
}

/**
 * validates a password against the application's password policy.
 * returns all violated rules so the client can display meaningful feedback.
 * note: error messages are specific here (client-facing in registration flow),
 * but login errors must remain generic to prevent user enumeration.
 *
 * @param password - the candidate password string
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`);
  }

  if (Buffer.byteLength(password, 'utf8') > PASSWORD_POLICY.MAX_LENGTH) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`);
  }

  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.REQUIRE_SPECIAL && !PASSWORD_POLICY.SPECIAL_CHARS_PATTERN.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  // check for common weak patterns
  if (/^(.)\1+$/.test(password)) {
    errors.push('Password cannot consist of repeating characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * generates a cryptographically secure random password reset token.
 * returns the raw token (for the email link) and a sha-256 hash (for db storage).
 * the raw token is NEVER stored in the database — only its hash is.
 * this means a stolen database cannot be used to reset arbitrary passwords.
 *
 * @returns { rawToken: string, tokenHash: string }
 */
export function generateResetToken(): { rawToken: string; tokenHash: string } {
  // 32 bytes = 256 bits of entropy — resistant to brute force
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * checks if a new password has been used in the password history.
 * compares the candidate against each stored bcrypt hash using timing-safe bcrypt.compare.
 * prevents users from rotating back to a previously used password.
 *
 * @param newPassword - the candidate new password
 * @param passwordHistory - array of previous bcrypt hashes
 * @returns true if the password has been used before, false if it's new
 */
export async function checkPasswordHistory(
  newPassword: string,
  passwordHistory: string[]
): Promise<boolean> {
  if (!passwordHistory || passwordHistory.length === 0) return false;

  // check each history entry — compare returns true if password matches the hash
  const checks = await Promise.all(
    passwordHistory.map((hash) => comparePassword(newPassword, hash))
  );

  // if any comparison returned true, the password was previously used
  return checks.some((matched) => matched);
}
