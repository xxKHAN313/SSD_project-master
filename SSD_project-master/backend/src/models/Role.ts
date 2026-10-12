/**
 * Role.ts
 *
 * role constants and helper exports.
 * roles are statically defined (not dynamic from DB) for simplicity and security.
 * this module re-exports role constants for convenience and provides
 * type guards for runtime role validation.
 */

export { ROLES, VALID_ROLES, UserRole } from '../config/constants';
export { ROLE_HIERARCHY, ROLE_PERMISSIONS, PERMISSIONS, hasPermission, isAtLeastRole } from '../config/roles';
