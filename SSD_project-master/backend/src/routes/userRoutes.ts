/**
 * userRoutes.ts
 *
 * route definitions for /api/users/* endpoints.
 * all routes are protected: require authentication + admin role.
 * input validation is applied to mutating endpoints.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  createUserValidations,
  updateUserValidations,
  assignRoleValidations,
} from '../validators/userValidator';
import {
  getAllUsersHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  assignRoleHandler,
  deactivateUserHandler,
  activateUserHandler,
  getUserActivityHandler,
} from '../controllers/userController';

const router = Router();

// apply authentication, admin role check, and rate limiting to all routes
router.use(verifyToken, requireAdmin, apiRateLimiter);

/**
 * GET /api/users
 * retrieves a paginated list of all users.
 * supports filtering by role, isActive, and username search.
 */
router.get('/', getAllUsersHandler);

/**
 * POST /api/users
 * creates a new user account (admin-initiated).
 * expects { username, email, password, role } in the body.
 */
router.post('/', validate(createUserValidations), createUserHandler);

/**
 * GET /api/users/:id
 * retrieves a single user by their MongoDB ObjectId.
 */
router.get('/:id', getUserByIdHandler);

/**
 * PUT /api/users/:id
 * updates a user's mutable fields (username, email).
 * role changes must use PUT /api/users/:id/role.
 */
router.put('/:id', validate(updateUserValidations), updateUserHandler);

/**
 * DELETE /api/users/:id
 * permanently deletes a user account.
 * also revokes all active sessions for that user.
 */
router.delete('/:id', deleteUserHandler);

/**
 * PUT /api/users/:id/role
 * assigns a new role to a user.
 * revokes all sessions — user must re-login to receive the new role in their token.
 * expects { role } in the body.
 */
router.put('/:id/role', validate(assignRoleValidations), assignRoleHandler);

/**
 * PUT /api/users/:id/deactivate
 * deactivates (soft-disables) a user account.
 * revokes all active sessions.
 */
router.put('/:id/deactivate', deactivateUserHandler);

/**
 * PUT /api/users/:id/activate
 * reactivates a previously deactivated user account.
 * also clears any account lockout state.
 */
router.put('/:id/activate', activateUserHandler);

/**
 * GET /api/users/:id/activity
 * returns recent audit log entries for a specific user.
 * query param: limit (default 20, max 100)
 */
router.get('/:id/activity', getUserActivityHandler);

export default router;
