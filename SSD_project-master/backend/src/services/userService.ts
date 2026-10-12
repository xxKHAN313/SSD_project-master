/**
 * userService.ts
 *
 * user management business logic: CRUD, role assignment, activation/deactivation.
 * all modifying operations generate audit log entries.
 * email is encrypted before storage; decrypted before return to admin callers.
 */

import mongoose from 'mongoose';
import { Request } from 'express';
import { User, IUser } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { revokeAllUserTokens } from './tokenService';
import { createLog } from './auditService';
import { encryptEmail, decryptEmail } from './encryptionService';
import { hashPassword, validatePasswordStrength, checkPasswordHistory } from '../utils/passwordUtils';
import { normalizeEmail } from '../utils/sanitizers';
import { AUDIT_ACTIONS, AUDIT_SEVERITY, UserRole, VALID_ROLES } from '../config/constants';
import { logger } from '../utils/logger';
import { USER_ERRORS } from '../utils/errorMessages';
import { PAGINATION } from '../config/constants';

/**
 * user DTO returned to admin API callers.
 * email is decrypted here — only admins/authorized callers see this.
 */
export interface UserDto {
  id: string;
  username: string;
  email: string; // decrypted
  role: UserRole;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * filters for listing users
 */
export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string; // username search
}

/**
 * converts a mongoose user document to a UserDto.
 * decrypts the email field.
 */
function toUserDto(user: IUser): UserDto {
  let email = '';
  try {
    email = decryptEmail(user.email);
  } catch {
    email = '[encrypted]'; // fallback if decryption fails
  }

  return {
    id: user._id.toString(),
    username: user.username,
    email,
    role: user.role,
    isActive: user.isActive,
    isLocked: user.isLocked,
    failedLoginAttempts: user.failedLoginAttempts,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * retrieves all users with optional filtering and pagination.
 *
 * @param filters - role, isActive, username search
 * @param page - page number
 * @param limit - items per page
 * @returns paginated user list
 */
export async function getAllUsers(
  filters: UserFilters,
  page: number = PAGINATION.DEFAULT_PAGE,
  limit: number = PAGINATION.DEFAULT_LIMIT
): Promise<{ users: UserDto[]; total: number; page: number; totalPages: number }> {
  const query: Record<string, unknown> = {};

  if (filters.role) query['role'] = filters.role;
  if (typeof filters.isActive === 'boolean') query['isActive'] = filters.isActive;
  if (filters.search) {
    // safe regex search on username field only (not encrypted fields)
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query['username'] = { $regex: escaped, $options: 'i' };
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), PAGINATION.MAX_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(false),
    User.countDocuments(query),
  ]);

  return {
    users: users.map(toUserDto),
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
}

/**
 * retrieves a single user by ID.
 * throws 404 if not found.
 *
 * @param id - mongodb objectid string
 * @returns UserDto with decrypted email
 */
export async function getUserById(id: string): Promise<UserDto> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  return toUserDto(user);
}

/**
 * creates a new user (admin-initiated).
 * validates uniqueness, encrypts email, hashes password.
 *
 * @param data - user creation data
 * @param requestingUserId - admin user performing the action
 * @param req - express request
 * @returns created UserDto
 */
export async function createUser(
  data: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
  },
  requestingUserId: string,
  req: Request
): Promise<UserDto> {
  // validate password
  const pwValidation = validatePasswordStrength(data.password);
  if (!pwValidation.valid) {
    throw Object.assign(new Error('Password does not meet requirements'), {
      statusCode: 400,
      details: pwValidation.errors,
    });
  }

  // validate role
  if (!VALID_ROLES.includes(data.role)) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 400 });
  }

  // check username uniqueness
  const existingUsername = await User.findOne({ username: data.username }).lean();
  if (existingUsername) {
    throw Object.assign(new Error('Username already in use'), { statusCode: 409 });
  }

  const normalizedEmail = normalizeEmail(data.email);
  const encryptedEmail = encryptEmail(normalizedEmail);
  const passwordHash = await hashPassword(data.password);

  const user = await User.create({
    username: data.username,
    email: encryptedEmail,
    passwordHash,
    role: data.role,
    passwordHistory: [passwordHash],
  });

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.USER_CREATED,
    targetId: user._id.toString(),
    targetType: 'User',
    details: { username: user.username, role: user.role },
    req,
    success: true,
  });

  logger.info('[userService] user created', { username: user.username, role: user.role });
  return toUserDto(user);
}

/**
 * updates a user's mutable fields (username, email).
 * role changes use the dedicated assignRole endpoint.
 *
 * @param id - target user ID
 * @param data - fields to update
 * @param requestingUserId - admin performing the action
 * @param req - express request
 * @returns updated UserDto
 */
export async function updateUser(
  id: string,
  data: { username?: string; email?: string },
  requestingUserId: string,
  req: Request
): Promise<UserDto> {
  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  if (data.username && data.username !== user.username) {
    const existing = await User.findOne({ username: data.username }).lean();
    if (existing) {
      throw Object.assign(new Error('Username already in use'), { statusCode: 409 });
    }
    user.username = data.username;
  }

  if (data.email) {
    user.email = encryptEmail(normalizeEmail(data.email));
  }

  await user.save();

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.USER_UPDATED,
    targetId: id,
    targetType: 'User',
    details: { updatedFields: Object.keys(data) },
    req,
    success: true,
  });

  return toUserDto(user);
}

/**
 * permanently deletes a user account.
 * revokes all sessions and creates an audit entry.
 * cannot delete own account.
 *
 * @param id - target user ID
 * @param requestingUserId - admin performing the deletion
 * @param req - express request
 */
export async function deleteUser(
  id: string,
  requestingUserId: string,
  req: Request
): Promise<void> {
  if (id === requestingUserId) {
    throw Object.assign(new Error(USER_ERRORS.CANNOT_DELETE_SELF), { statusCode: 400 });
  }

  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  const username = user.username;

  // revoke all sessions before deletion
  await revokeAllUserTokens(id);
  await User.findByIdAndDelete(id);

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.USER_DELETED,
    targetId: id,
    targetType: 'User',
    details: { deletedUsername: username },
    severity: AUDIT_SEVERITY.CRITICAL,
    req,
    success: true,
  });

  logger.info('[userService] user deleted', { deletedId: id, deletedUsername: username });
}

/**
 * deactivates a user account (soft disable).
 * revokes all active sessions.
 * cannot deactivate own account.
 *
 * @param id - target user ID
 * @param requestingUserId - admin performing the action
 * @param req - express request
 */
export async function deactivateUser(
  id: string,
  requestingUserId: string,
  req: Request
): Promise<UserDto> {
  if (id === requestingUserId) {
    throw Object.assign(new Error(USER_ERRORS.CANNOT_DEACTIVATE_SELF), { statusCode: 400 });
  }

  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  user.isActive = false;
  await user.save();
  await revokeAllUserTokens(id);

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.USER_DEACTIVATED,
    targetId: id,
    targetType: 'User',
    details: { username: user.username },
    req,
    success: true,
  });

  return toUserDto(user);
}

/**
 * reactivates a previously deactivated user account.
 *
 * @param id - target user ID
 * @param requestingUserId - admin performing the action
 * @param req - express request
 */
export async function activateUser(
  id: string,
  requestingUserId: string,
  req: Request
): Promise<UserDto> {
  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  user.isActive = true;
  // clear any lockout when reactivating
  user.isLocked = false;
  user.lockoutExpires = null;
  user.failedLoginAttempts = 0;
  await user.save();

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.USER_ACTIVATED,
    targetId: id,
    targetType: 'User',
    details: { username: user.username },
    req,
    success: true,
  });

  return toUserDto(user);
}

/**
 * assigns a new role to a user.
 * revokes all sessions to force re-authentication with new role token.
 * cannot change own role.
 *
 * @param id - target user ID
 * @param newRole - the role to assign
 * @param requestingUserId - admin performing the action
 * @param req - express request
 */
export async function assignRole(
  id: string,
  newRole: UserRole,
  requestingUserId: string,
  req: Request
): Promise<UserDto> {
  if (id === requestingUserId) {
    throw Object.assign(new Error(USER_ERRORS.CANNOT_CHANGE_OWN_ROLE), { statusCode: 400 });
  }

  if (!VALID_ROLES.includes(newRole)) {
    throw Object.assign(new Error(USER_ERRORS.INVALID_ROLE), { statusCode: 400 });
  }

  const user = await User.findById(id);
  if (!user) {
    throw Object.assign(new Error(USER_ERRORS.NOT_FOUND), { statusCode: 404 });
  }

  const previousRole = user.role;
  user.role = newRole;
  await user.save();

  // revoke all sessions — user must re-login to get a token with the new role
  await revokeAllUserTokens(id);

  await createLog({
    userId: requestingUserId,
    action: AUDIT_ACTIONS.ROLE_CHANGE,
    targetId: id,
    targetType: 'User',
    details: { username: user.username, previousRole, newRole },
    severity: AUDIT_SEVERITY.CRITICAL,
    req,
    success: true,
  });

  logger.info('[userService] role changed', {
    targetId: id,
    previousRole,
    newRole,
  });

  return toUserDto(user);
}

/**
 * returns recent audit activity for a specific user.
 * used by admin to review user history.
 *
 * @param userId - the user to look up
 * @param limit - number of recent entries to return
 */
export async function getUserActivityLogs(
  userId: string,
  limit = 20
): Promise<unknown[]> {
  const logs = await AuditLog.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  return logs;
}
