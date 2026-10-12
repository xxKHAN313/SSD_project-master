/**
 * authService.ts
 *
 * authentication business logic: registration, login, logout, password reset.
 * all authentication operations generate audit log entries.
 * error messages returned to callers must remain generic (no internal details).
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request } from 'express';
import { User, IUser } from '../models/User';
import { PasswordReset } from '../models/PasswordReset';
import { createTokenPair, revokeToken, refreshTokens as rotateTokens, revokeAllUserTokens } from './tokenService';
import { createLog } from './auditService';
import { encryptEmail, decryptEmail } from './encryptionService';
import { sendPasswordResetEmail, sendWelcomeEmail } from './emailService';
import { hashPassword, validatePasswordStrength, generateResetToken, checkPasswordHistory } from '../utils/passwordUtils';
import { normalizeEmail } from '../utils/sanitizers';
import { AUDIT_ACTIONS, AUDIT_SEVERITY, LOCKOUT_POLICY, UserRole } from '../config/constants';
import { logger } from '../utils/logger';
import { AUTH_ERRORS, REGISTER_ERRORS, PASSWORD_RESET_ERRORS } from '../utils/errorMessages';

/**
 * registration input DTO
 */
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

/**
 * login credentials DTO
 */
export interface LoginInput {
  username: string;
  password: string;
}

/**
 * response from successful login or register
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  };
}

/**
 * finds a user by their plaintext email address.
 * since emails are encrypted with random IVs, we must fetch all users
 * and decrypt each email for comparison.
 * note: for large user bases, consider HMAC-indexed lookup.
 */
async function findUserByEmail(email: string): Promise<IUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const users = await User.find({}).select('+passwordHash +passwordHistory').lean(false);

  for (const user of users) {
    try {
      const decrypted = decryptEmail(user.email);
      if (decrypted === normalizedEmail) return user;
    } catch {
      // skip records that fail to decrypt (corrupted or wrong key)
      continue;
    }
  }
  return null;
}

/**
 * registers a new user account.
 * validates password strength, checks for existing username/email,
 * encrypts the email, hashes the password, and creates the user.
 *
 * @param input - registration data
 * @param req - express request for audit logging
 * @returns auth tokens and user info
 */
export async function register(input: RegisterInput, req: Request): Promise<AuthResult> {
  const { username, email, password } = input;
  const normalizedEmail = normalizeEmail(email);

  // validate password strength before any DB operations
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw Object.assign(new Error(REGISTER_ERRORS.WEAK_PASSWORD), {
      statusCode: 400,
      details: passwordValidation.errors,
    });
  }

  // check username uniqueness — case-insensitive so "Employee" and "employee"
  // can't both exist (would be ambiguous on case-insensitive login)
  const existingUsername = await User.findByUsername(username);
  if (existingUsername) {
    throw Object.assign(new Error(REGISTER_ERRORS.USERNAME_TAKEN), { statusCode: 409 });
  }

  // check email uniqueness (requires decrypting all emails)
  const existingEmail = await findUserByEmail(normalizedEmail);
  if (existingEmail) {
    throw Object.assign(new Error(REGISTER_ERRORS.EMAIL_TAKEN), { statusCode: 409 });
  }

  // encrypt email before storage (AES-256-GCM)
  const encryptedEmail = encryptEmail(normalizedEmail);

  // hash password with bcrypt (12 rounds)
  const passwordHash = await hashPassword(password);

  // determine role — only admin can set non-default roles via the user management API
  // registration always creates employee-level accounts
  const role: UserRole = 'employee';

  const user = await User.create({
    username,
    email: encryptedEmail,
    passwordHash,
    role,
    passwordHistory: [passwordHash], // add initial hash to history
  });

  // create token pair for immediate login after registration
  const ipAddress = req.ip ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString(),
    role,
    ipAddress,
    userAgent
  );

  // audit log — registration event
  await createLog({
    userId: user._id.toString(),
    username: user.username,
    action: AUDIT_ACTIONS.REGISTER,
    details: { role },
    req,
    success: true,
  });

  // send welcome email (fire and forget — don't await failure)
  sendWelcomeEmail(normalizedEmail, username).catch(() => {
    // already logged inside emailService
  });

  logger.info('[authService] new user registered', { username, role });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

/**
 * authenticates a user with username and password.
 * handles lockout checks, failed attempt tracking, and audit logging.
 * always returns generic errors to prevent user enumeration.
 *
 * @param input - login credentials
 * @param req - express request for IP/UA extraction and audit logging
 * @returns auth tokens and user info
 */
export async function login(input: LoginInput, req: Request): Promise<AuthResult> {
  const { username, password } = input;
  const ipAddress = req.ip ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';

  // fetch user with password hash (select: false by default)
  const user = await User.findByUsername(username);

  if (!user) {
    // always log failed attempts even for non-existent users (brute force detection)
    await createLog({
      userId: null,
      username,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      details: { reason: 'user not found' },
      severity: AUDIT_SEVERITY.WARNING,
      req,
      success: false,
    });
    // generic error — do not reveal whether username exists
    throw Object.assign(new Error(AUTH_ERRORS.INVALID_CREDENTIALS), { statusCode: 401 });
  }

  // check account active status
  if (!user.isActive) {
    await createLog({
      userId: user._id.toString(),
      username: user.username,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      details: { reason: 'account inactive' },
      severity: AUDIT_SEVERITY.WARNING,
      req,
      success: false,
    });
    // use generic error to prevent confirming username existence
    throw Object.assign(new Error(AUTH_ERRORS.INVALID_CREDENTIALS), { statusCode: 401 });
  }

  // check account lockout status (auto-clears expired lockouts)
  if (user.isLockedOut()) {
    await user.save(); // persist auto-cleared lockout state if applicable
    if (user.isLocked) {
      await createLog({
        userId: user._id.toString(),
        username: user.username,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        details: { reason: 'account locked', lockoutExpires: user.lockoutExpires },
        severity: AUDIT_SEVERITY.WARNING,
        req,
        success: false,
      });
      throw Object.assign(new Error(AUTH_ERRORS.ACCOUNT_LOCKED), { statusCode: 423 });
    }
  }

  // verify password using bcrypt's timing-safe comparison
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // increment failed login counter (may trigger lockout)
    await user.incrementFailedLogin();

    const locked = user.failedLoginAttempts >= LOCKOUT_POLICY.MAX_FAILED_ATTEMPTS;

    await createLog({
      userId: user._id.toString(),
      username: user.username,
      action: locked ? AUDIT_ACTIONS.ACCOUNT_LOCKED : AUDIT_ACTIONS.LOGIN_FAILURE,
      details: {
        reason: 'invalid password',
        attempts: user.failedLoginAttempts,
        locked,
      },
      severity: locked ? AUDIT_SEVERITY.CRITICAL : AUDIT_SEVERITY.WARNING,
      req,
      success: false,
    });

    // use the same generic message regardless of lockout state
    // this prevents attackers from learning the lockout threshold
    throw Object.assign(new Error(AUTH_ERRORS.INVALID_CREDENTIALS), { statusCode: 401 });
  }

  // successful login — reset failed counter and update last login
  await user.resetFailedLogin();

  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString(),
    user.role,
    ipAddress,
    userAgent
  );

  await createLog({
    userId: user._id.toString(),
    username: user.username,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    details: { role: user.role },
    req,
    success: true,
  });

  logger.info('[authService] user logged in', { username, role: user.role });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

/**
 * logs out a user by revoking their current refresh token session.
 *
 * @param userId - the authenticated user's ID
 * @param rawRefreshToken - the refresh token from the cookie
 * @param req - express request for audit logging
 */
export async function logout(
  userId: string,
  rawRefreshToken: string,
  req: Request
): Promise<void> {
  await revokeToken(rawRefreshToken);

  await createLog({
    userId,
    action: AUDIT_ACTIONS.LOGOUT,
    req,
    success: true,
  });

  logger.info('[authService] user logged out', { userId });
}

/**
 * initiates a password reset flow.
 * always returns success — never reveals whether the email exists in the system.
 * this prevents email enumeration attacks.
 *
 * @param email - the plaintext email address submitted
 * @param req - express request for audit logging
 */
export async function forgotPassword(email: string, req: Request): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    // still log the attempt (for security monitoring) but return success to client
    await createLog({
      userId: null,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      details: { email: normalizedEmail, found: false },
      req,
      success: false,
    });
    // delay response slightly to prevent timing-based enumeration
    await new Promise((resolve) => setTimeout(resolve, 500));
    return; // silently succeed — caller shows generic "check your email" message
  }

  const { rawToken, tokenHash } = generateResetToken();

  await PasswordReset.create({
    userId: user._id,
    tokenHash,
  });

  // send email (non-blocking)
  await sendPasswordResetEmail(normalizedEmail, rawToken);

  await createLog({
    userId: user._id.toString(),
    username: user.username,
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
    req,
    success: true,
  });

  logger.info('[authService] password reset initiated', { userId: user._id.toString() });
}

/**
 * completes the password reset flow.
 * validates the token, enforces password policy and history,
 * updates the password, and revokes all existing sessions.
 *
 * @param rawToken - the token from the reset link
 * @param newPassword - the new password
 * @param req - express request for audit logging
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
  req: Request
): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const resetRecord = await PasswordReset.findValidToken(tokenHash);

  if (!resetRecord) {
    await createLog({
      userId: null,
      action: AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
      details: { reason: 'invalid or expired token' },
      req,
      success: false,
    });
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.TOKEN_INVALID), { statusCode: 400 });
  }

  const user = await User.findById(resetRecord.userId).select('+passwordHash +passwordHistory');

  if (!user) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.RESET_FAILED), { statusCode: 400 });
  }

  // validate new password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.RESET_FAILED), {
      statusCode: 400,
      details: validation.errors,
    });
  }

  // check password history — prevent reusing last 5 passwords
  const isReused = await checkPasswordHistory(newPassword, user.passwordHistory);
  if (isReused) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.PASSWORD_REUSED), { statusCode: 400 });
  }

  // hash the new password
  const newHash = await hashPassword(newPassword);

  // update password and history (keep last 5 hashes)
  user.passwordHash = newHash;
  user.passwordHistory = [...user.passwordHistory.slice(-4), newHash];
  await user.save();

  // mark token as used (prevents replay)
  await PasswordReset.invalidateAllForUser(user._id.toString());

  // revoke all active sessions — forces re-login on all devices
  await revokeAllUserTokens(user._id.toString());

  await createLog({
    userId: user._id.toString(),
    username: user.username,
    action: AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
    req,
    success: true,
  });

  logger.info('[authService] password reset completed', { userId: user._id.toString() });
}

/**
 * refreshes an access token using a valid refresh token.
 * delegates to tokenService for rotation logic.
 *
 * @param rawRefreshToken - the refresh token from the httpOnly cookie
 * @param req - express request
 * @returns new token pair or null if invalid
 */
export async function refreshAuthTokens(
  rawRefreshToken: string,
  req: Request
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const ipAddress = req.ip ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';

  const result = await rotateTokens(rawRefreshToken, ipAddress, userAgent);

  if (result) {
    await createLog({
      userId: result.userId,
      action: AUDIT_ACTIONS.TOKEN_REFRESH,
      req,
      success: true,
    });
  }

  return result;
}

/**
 * changes the authenticated user's password.
 * requires the current password for re-authentication,
 * validates new password strength, checks reuse history,
 * updates the hash and revokes all existing sessions so the user
 * must re-login on every device.
 *
 * @param userId - the authenticated user's id (from the access token)
 * @param currentPassword - current password for re-authentication
 * @param newPassword - the new plaintext password
 * @param req - express request for audit logging
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  req: Request
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error(AUTH_ERRORS.TOKEN_INVALID), { statusCode: 401 });
  }

  const user = await User.findById(userId).select('+passwordHash +passwordHistory');
  if (!user) {
    throw Object.assign(new Error(AUTH_ERRORS.TOKEN_INVALID), { statusCode: 401 });
  }

  // re-authenticate with the current password — prevents session-hijack abuse
  const currentValid = await user.comparePassword(currentPassword);
  if (!currentValid) {
    await createLog({
      userId: user._id.toString(),
      username: user.username,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      details: { reason: 'change-password: invalid current password' },
      severity: AUDIT_SEVERITY.WARNING,
      req,
      success: false,
    });
    throw Object.assign(new Error(AUTH_ERRORS.INVALID_CREDENTIALS), { statusCode: 401 });
  }

  // validate new password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.RESET_FAILED), {
      statusCode: 400,
      details: validation.errors,
    });
  }

  // disallow reusing the current password
  const sameAsCurrent = await user.comparePassword(newPassword);
  if (sameAsCurrent) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.SAME_AS_CURRENT), { statusCode: 400 });
  }

  // disallow reusing any of the last N passwords
  const isReused = await checkPasswordHistory(newPassword, user.passwordHistory);
  if (isReused) {
    throw Object.assign(new Error(PASSWORD_RESET_ERRORS.PASSWORD_REUSED), { statusCode: 400 });
  }

  const newHash = await hashPassword(newPassword);
  user.passwordHash = newHash;
  user.passwordHistory = [...user.passwordHistory.slice(-4), newHash];
  await user.save();

  // revoke all active sessions — user must re-login everywhere
  await revokeAllUserTokens(user._id.toString());

  await createLog({
    userId: user._id.toString(),
    username: user.username,
    action: AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
    details: { reason: 'self-service password change' },
    req,
    success: true,
  });

  logger.info('[authService] user changed password', { userId: user._id.toString() });
}

/**
 * returns the authenticated user's profile (no sensitive fields).
 *
 * @param userId - the authenticated user's ID from the JWT
 * @returns user profile object
 */
export async function getMe(userId: string): Promise<{
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}> {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw Object.assign(new Error(AUTH_ERRORS.TOKEN_INVALID), { statusCode: 401 });
  }

  // decrypt the AES-encrypted email so the user can see their own address.
  // decryption failures should not crash the profile request — return empty instead.
  let email = '';
  try {
    email = decryptEmail(user.email);
  } catch {
    email = '';
  }

  return {
    id: user._id.toString(),
    username: user.username,
    email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}
