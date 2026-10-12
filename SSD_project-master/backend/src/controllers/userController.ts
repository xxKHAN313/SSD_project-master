/**
 * userController.ts
 *
 * HTTP request handlers for user management endpoints (admin only).
 * delegates all business logic to userService.
 * errors are forwarded to next(error) for the global error handler.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
  assignRole,
  getUserActivityLogs,
} from '../services/userService';
import { HTTP_STATUS, PAGINATION } from '../config/constants';
import type { UserRole } from '../config/constants';
import type { UserFilters } from '../services/userService';

/**
 * GET /api/users
 * retrieves a paginated list of all users with optional filters.
 * query params: page, limit, role, isActive, search
 */
export async function getAllUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt((req.query['page'] as string) ?? '1', 10) || PAGINATION.DEFAULT_PAGE;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || PAGINATION.DEFAULT_LIMIT;

    const filters: UserFilters = {};

    if (req.query['role']) {
      filters.role = req.query['role'] as UserRole;
    }

    if (req.query['isActive'] !== undefined) {
      filters.isActive = req.query['isActive'] === 'true';
    }

    if (req.query['search']) {
      filters.search = req.query['search'] as string;
    }

    const result = await getAllUsers(filters, page, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 * retrieves a single user by their MongoDB ObjectId.
 */
export async function getUserByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const user = await getUserById(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/users
 * creates a new user account (admin-initiated).
 * expects { username, email, password, role } in the request body.
 */
export async function createUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, email, password, role } = req.body as {
      username: string;
      email: string;
      password: string;
      role: UserRole;
    };
    const requestingUserId = req.user!.userId;

    const user = await createUser({ username, email, password, role }, requestingUserId, req);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'User created successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id
 * updates a user's mutable fields (username, email).
 * role changes must use the dedicated /role endpoint.
 */
export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { username, email } = req.body as { username?: string; email?: string };
    const requestingUserId = req.user!.userId;

    const user = await updateUser(id, { username, email }, requestingUserId, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User updated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/:id
 * permanently deletes a user account.
 * admins cannot delete their own account.
 */
export async function deleteUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const requestingUserId = req.user!.userId;

    await deleteUser(id, requestingUserId, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id/role
 * assigns a new role to a user.
 * admins cannot change their own role.
 * revokes all sessions — user must re-login to get a new role token.
 * expects { role } in the request body.
 */
export async function assignRoleHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: UserRole };
    const requestingUserId = req.user!.userId;

    const user = await assignRole(id, role, requestingUserId, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User role updated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id/deactivate
 * deactivates a user account (soft disable).
 * revokes all active sessions.
 * admins cannot deactivate their own account.
 */
export async function deactivateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const requestingUserId = req.user!.userId;

    const user = await deactivateUser(id, requestingUserId, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User deactivated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/users/:id/activate
 * reactivates a previously deactivated user account.
 * clears lockout state and resets failed login attempts.
 */
export async function activateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const requestingUserId = req.user!.userId;

    const user = await activateUser(id, requestingUserId, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'User activated successfully.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id/activity
 * returns recent audit log entries for a specific user.
 * query param: limit (default 20, max 100)
 */
export async function getUserActivityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;

    const logs = await getUserActivityLogs(id, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { logs, count: logs.length },
    });
  } catch (error) {
    next(error);
  }
}
