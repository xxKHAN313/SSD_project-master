/**
 * @fileoverview Authentication hook.
 * Wraps AuthContext and adds role-based convenience helpers
 * so components don't need to import the context directly.
 */

import { useAuthContext } from '../store/authContext';
import { UserRole } from '../types';
import { ROLES } from '../utils/constants';

// permission strings used across the application for fine-grained access control
export type Permission =
  | 'view:adminPanel'
  | 'manage:users'
  | 'manage:rooms'
  | 'delete:anyMessage'
  | 'view:auditLogs'
  | 'assign:roles'
  | 'deactivate:users'
  | 'create:rooms'
  | 'view:allRooms';

// permission map: which roles have which permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  employee: [],
  manager: [
    'create:rooms',
    'view:allRooms',
  ],
  admin: [
    'view:adminPanel',
    'manage:users',
    'manage:rooms',
    'delete:anyMessage',
    'view:auditLogs',
    'assign:roles',
    'deactivate:users',
    'create:rooms',
    'view:allRooms',
  ],
};

export function useAuth() {
  const context = useAuthContext();
  const { user, isAuthenticated, isLoading, error } = context;

  // convenience role checks - avoids string comparison at call sites
  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isEmployee = user?.role === ROLES.EMPLOYEE;

  /**
   * Check if the current user has a specific role.
   */
  function hasRole(role: UserRole): boolean {
    return user?.role === role;
  }

  /**
   * Check if the current user has a specific permission.
   * Admins always have all permissions.
   */
  function canAccess(permission: Permission): boolean {
    if (!user || !isAuthenticated) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
  }

  /**
   * Check if the user can perform an action on a resource owned by ownerUserId.
   * Admins can always act; regular users can only act on their own resources.
   */
  function canModify(ownerUserId: string): boolean {
    if (!user) return false;
    return isAdmin || user.id === ownerUserId;
  }

  return {
    // auth state
    user,
    isAuthenticated,
    isLoading,
    error,

    // role shortcuts
    isAdmin,
    isManager,
    isEmployee,

    // permission helpers
    hasRole,
    canAccess,
    canModify,

    // auth actions delegated from context
    login: context.login,
    logout: context.logout,
    register: context.register,
    updateUser: context.updateUser,
    clearError: context.clearError,
  };
}

export default useAuth;
