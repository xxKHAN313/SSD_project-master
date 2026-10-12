/**
 * roles.ts
 *
 * defines the role hierarchy and permission map for RBAC (role-based access control).
 * all authorization decisions reference this module.
 * the hierarchy is: admin > manager > employee.
 * default-deny: if a permission is not explicitly granted, it is denied.
 */

import { ROLES, UserRole } from './constants';

/**
 * numeric hierarchy level for each role.
 * higher number = more privileges.
 * used to check if a user has at least a certain permission level.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [ROLES.EMPLOYEE]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.ADMIN]: 3,
};

/**
 * permission identifiers — each is a discrete capability in the system.
 * controllers/middleware check these rather than role strings directly,
 * making it easy to adjust permissions without rewriting business logic.
 */
export const PERMISSIONS = {
  // user management
  USER_VIEW_ALL: 'USER_VIEW_ALL',
  USER_VIEW_SINGLE: 'USER_VIEW_SINGLE',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_ASSIGN_ROLE: 'USER_ASSIGN_ROLE',
  USER_ACTIVATE: 'USER_ACTIVATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',

  // messaging
  MESSAGE_SEND: 'MESSAGE_SEND',
  MESSAGE_READ: 'MESSAGE_READ',
  MESSAGE_DELETE_OWN: 'MESSAGE_DELETE_OWN',
  MESSAGE_DELETE_ANY: 'MESSAGE_DELETE_ANY',

  // chat rooms
  ROOM_VIEW: 'ROOM_VIEW',
  ROOM_CREATE: 'ROOM_CREATE',
  ROOM_DELETE: 'ROOM_DELETE',

  // audit logs
  AUDIT_VIEW: 'AUDIT_VIEW',
  AUDIT_EXPORT: 'AUDIT_EXPORT',

  // system
  HEALTH_VIEW: 'HEALTH_VIEW',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * maps each role to the set of permissions it is granted.
 * this is the source of truth for all authorization checks.
 * admin inherits all manager and employee permissions plus exclusive ones.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_DELETE_OWN,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.HEALTH_VIEW,
  ],

  [ROLES.MANAGER]: [
    // inherits all employee permissions
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_DELETE_OWN,
    PERMISSIONS.MESSAGE_DELETE_ANY,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.USER_VIEW_SINGLE,
    PERMISSIONS.HEALTH_VIEW,
  ],

  [ROLES.ADMIN]: [
    // inherits all permissions — full system access
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_DELETE_OWN,
    PERMISSIONS.MESSAGE_DELETE_ANY,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.ROOM_DELETE,
    PERMISSIONS.USER_VIEW_ALL,
    PERMISSIONS.USER_VIEW_SINGLE,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_ASSIGN_ROLE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.HEALTH_VIEW,
  ],
};

/**
 * checks whether a given role has a specific permission.
 * returns false for any unknown role or permission (default deny).
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * checks whether a role is at or above a minimum hierarchy level.
 * useful for "at least manager" style checks.
 */
export function isAtLeastRole(role: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * returns all roles that have a given permission.
 * useful for documentation and testing.
 */
export function getRolesWithPermission(permission: Permission): UserRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
}
