/**
 * @fileoverview User management page for admins.
 * Search, filter, create, deactivate/activate, delete, and role-change users.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from './Admin.module.css';
import MainLayout from '../Layout/MainLayout';
import Button from '../Common/Button';
import Input from '../Common/Input';
import UserTable from './UserTable';
import { useAppContext } from '../../store/appContext';
import userService from '../../services/userService';
import { UserProfile } from '../../types';
import { UserRole } from '../../types/auth';
import {
  validateEmail,
  validateUsername,
  validatePassword,
} from '../../utils/validators';

interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

interface CreateUserErrors {
  username?: string;
  email?: string;
  password?: string;
}

export function UserManagement(): JSX.Element {
  const { addToast } = useAppContext();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    email: '',
    password: '',
    role: 'employee',
  });
  const [createErrors, setCreateErrors] = useState<CreateUserErrors>({});
  const [isCreating, setIsCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await userService.getAllUsers({ limit: 500 });
      setUsers(resp.users);
    } catch {
      addToast('error', 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // apply client-side filters on top of the full user list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'active' ? u.isActive : !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateChange = (field: keyof CreateUserForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setCreateForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (createErrors[field as keyof CreateUserErrors]) {
      setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateCreateForm = (): boolean => {
    const errors: CreateUserErrors = {};
    const usernameErr = validateUsername(createForm.username);
    if (usernameErr) errors.username = usernameErr;
    const emailErr = validateEmail(createForm.email);
    if (emailErr) errors.email = emailErr;
    const passwordErr = validatePassword(createForm.password);
    if (passwordErr) errors.password = passwordErr;
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm()) return;
    setIsCreating(true);
    try {
      const newUser = await userService.createUser({
        username: createForm.username.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
      });
      setUsers((prev) => [newUser, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ username: '', email: '', password: '', role: 'employee' });
      addToast('success', `User "${newUser.username}" created successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.';
      addToast('error', msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await userService.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      addToast('success', 'User deleted.');
    } catch {
      addToast('error', 'Failed to delete user.');
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const updated = await userService.deactivateUser(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      addToast('success', 'User deactivated.');
    } catch {
      addToast('error', 'Failed to deactivate user.');
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      const updated = await userService.activateUser(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      addToast('success', 'User activated.');
    } catch {
      addToast('error', 'Failed to activate user.');
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      const updated = await userService.assignRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      addToast('success', `Role updated to "${role}" successfully.`);
    } catch {
      addToast('error', 'Failed to update role.');
      throw new Error('Role update failed');
    }
  };

  return (
    <MainLayout>
      <div>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>User Management</h1>
            <p className={styles.pageSubtitle}>
              {users.length} total users · {users.filter((u) => u.isActive).length} active
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            iconLeft={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Add User
          </Button>
        </div>

        {/* search + filter row */}
        <div className={styles.filterRow}>
          <input
            type="search"
            className={styles.filterInput}
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search users"
          />
          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | '')}
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* user data table */}
        <UserTable
          users={filteredUsers}
          isLoading={isLoading}
          onEdit={() => {}} // edit is handled inline via RoleAssignment
          onDelete={handleDelete}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
          onRoleChange={handleRoleChange}
        />

        {/* create user modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className={styles.modalCard}>
              <div>
                <h2 className={styles.modalTitle} id="create-user-title">
                  Add New User
                </h2>
                <p className={styles.modalSubtitle}>
                  Create a new user account with an initial role.
                </p>
              </div>

              <Input
                label="Username"
                type="text"
                value={createForm.username}
                onChange={handleCreateChange('username') as React.ChangeEventHandler<HTMLInputElement>}
                error={createErrors.username}
                placeholder="new_user"
                required
                disabled={isCreating}
              />

              <Input
                label="Email Address"
                type="email"
                value={createForm.email}
                onChange={handleCreateChange('email') as React.ChangeEventHandler<HTMLInputElement>}
                error={createErrors.email}
                placeholder="user@company.com"
                required
                disabled={isCreating}
              />

              <Input
                label="Initial Password"
                type="password"
                value={createForm.password}
                onChange={handleCreateChange('password') as React.ChangeEventHandler<HTMLInputElement>}
                error={createErrors.password}
                placeholder="Strong temporary password"
                required
                disabled={isCreating}
              />

              <div>
                <label
                  htmlFor="create-role"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-text-primary)' }}
                >
                  Role
                </label>
                <select
                  id="create-role"
                  className={styles.filterSelect}
                  value={createForm.role}
                  onChange={handleCreateChange('role')}
                  style={{ width: '100%' }}
                  disabled={isCreating}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateErrors({});
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  loading={isCreating}
                >
                  Create User
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default UserManagement;
