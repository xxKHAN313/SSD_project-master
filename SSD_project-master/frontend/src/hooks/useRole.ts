/**
 * @fileoverview Role permission hook.
 * Derives boolean permission flags from the current user's role.
 * Components use this to conditionally render UI based on what the user can do.
 */

import { useAuth } from './useAuth';

export interface RolePermissions {
  // admin panel and admin-only features
  canViewAdminPanel: boolean;
  canManageUsers: boolean;
  canManageRooms: boolean;
  canDeleteMessages: boolean;
  canViewAuditLogs: boolean;
  canAssignRoles: boolean;
  canDeactivateUsers: boolean;
  // manager and admin features
  canCreateRooms: boolean;
  canViewAllRooms: boolean;
  // info about current role
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  roleName: string;
}

export function useRole(): RolePermissions {
  const { user, isAdmin, isManager, isEmployee, canAccess } = useAuth();

  return {
    // admin-only permissions
    canViewAdminPanel: canAccess('view:adminPanel'),
    canManageUsers: canAccess('manage:users'),
    canManageRooms: canAccess('manage:rooms'),
    canDeleteMessages: canAccess('delete:anyMessage'),
    canViewAuditLogs: canAccess('view:auditLogs'),
    canAssignRoles: canAccess('assign:roles'),
    canDeactivateUsers: canAccess('deactivate:users'),

    // manager and admin permissions
    canCreateRooms: canAccess('create:rooms'),
    canViewAllRooms: canAccess('view:allRooms'),

    // role identity flags
    isAdmin,
    isManager,
    isEmployee,
    roleName: user?.role ?? '',
  };
}

export default useRole;
