/**
 * @fileoverview Form validation utility functions.
 * Pure functions that validate user input and return error messages or null.
 * Used across all forms in the application.
 */

// password strength levels returned by validatePasswordStrength
export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-4
  suggestions: string[];
  color: string; // css color for the strength bar
}

/**
 * Validate an email address format.
 * @returns error message string or null if valid
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return 'Email address is required.';
  }
  // standard email regex covering most valid formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (email.length > 254) {
    return 'Email address is too long.';
  }
  return null;
}

/**
 * Validate a password meets security requirements:
 * - 8+ characters
 * - at least one uppercase letter
 * - at least one lowercase letter
 * - at least one digit
 * - at least one special character
 * @returns error message string or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*...).';
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  return null;
}

/**
 * Validate a username:
 * - 3-30 characters
 * - alphanumeric and underscore only
 * - must not start or end with underscore
 * @returns error message string or null if valid
 */
export function validateUsername(username: string): string | null {
  if (!username.trim()) {
    return 'Username is required.';
  }
  if (username.length < 3) {
    return 'Username must be at least 3 characters long.';
  }
  if (username.length > 30) {
    return 'Username cannot exceed 30 characters.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  if (/^_|_$/.test(username)) {
    return 'Username cannot start or end with an underscore.';
  }
  return null;
}

/**
 * Validate that two password fields match.
 * @returns error message string or null if they match
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | null {
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}

/**
 * Analyze password strength and return a detailed result with suggestions.
 * Scores from 0 (very weak) to 4 (very strong).
 */
export function validatePasswordStrength(
  password: string
): PasswordStrengthResult {
  const suggestions: string[] = [];
  let score = 0;

  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      suggestions: ['Enter a password to check its strength.'],
      color: '#EF4444',
    };
  }

  // length scoring - longer passwords are significantly stronger
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  else suggestions.push('Use 16+ characters for maximum strength.');

  // character variety scoring
  if (/[A-Z]/.test(password)) score++;
  else suggestions.push('Add uppercase letters (A-Z).');

  if (/[a-z]/.test(password)) score++;
  else suggestions.push('Add lowercase letters (a-z).');

  if (/[0-9]/.test(password)) score++;
  else suggestions.push('Add numbers (0-9).');

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
  else suggestions.push('Add special characters (!@#$%^&*...).');

  // penalize common patterns
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid repeating characters (aaa, 111).');
  }

  // normalize score to 0-4
  const normalizedScore = Math.min(4, Math.floor(score / 2));

  const strengthMap: Record<
    number,
    { strength: PasswordStrength; color: string }
  > = {
    0: { strength: 'weak', color: '#EF4444' },
    1: { strength: 'weak', color: '#EF4444' },
    2: { strength: 'fair', color: '#F59E0B' },
    3: { strength: 'strong', color: '#10B981' },
    4: { strength: 'very-strong', color: '#059669' },
  };

  const { strength, color } = strengthMap[normalizedScore];

  return { strength, score: normalizedScore, suggestions, color };
}

/**
 * Validate a non-empty text field with optional max length.
 * @returns error message string or null if valid
 */
export function validateRequired(
  value: string,
  fieldName: string,
  maxLength?: number
): string | null {
  if (!value.trim()) {
    return `${fieldName} is required.`;
  }
  if (maxLength && value.length > maxLength) {
    return `${fieldName} cannot exceed ${maxLength} characters.`;
  }
  return null;
}
