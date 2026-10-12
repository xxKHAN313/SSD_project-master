/**
 * @fileoverview User data table component for the admin user management page.
 * Supports sortable columns, role/status badges, action buttons, and pagination.
 */

import React, { useState } from 'react';
import styles from './Admin.module.css';
import Button from '../Common/Button';
import RoleAssignment from './RoleAssignment';
import { UserProfile } from '../../types';
import { UserRole } from '../../types/auth';

type SortKey = 'username' | 'email' | 'role' | 'lastLogin' | 'createdAt';
type SortDir = 'asc' | 'desc';

// maps internal sort direction to valid HTML aria-sort attribute values
function ariaSort(key: SortKey, activeKey: SortKey, dir: SortDir): 'none' | 'ascending' | 'descending' {
  if (activeKey !== key) return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}

interface UserTableProps {
  users: UserProfile[];
  isLoading: boolean;
  onEdit: (user: UserProfile) => void;
  onDelete: (userId: string) => void;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
}

// format a nullable ISO date to a display string
function formatDate(d: string | null): string {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const PAGE_SIZE = 15;

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDelete,
  onDeactivate,
  onActivate,
  onRoleChange,
}: UserTableProps): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [roleModalUser, setRoleModalUser] = useState<UserProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  // sort a copy of the array — never mutate props
  const sorted = [...users].sort((a, b) => {
    let aVal: string = '';
    let bVal: string = '';

    if (sortKey === 'username') { aVal = a.username; bVal = b.username; }
    else if (sortKey === 'email') { aVal = a.email; bVal = b.email; }
    else if (sortKey === 'role') { aVal = a.role; bVal = b.role; }
    else if (sortKey === 'lastLogin') { aVal = a.lastLogin || ''; bVal = b.lastLogin || ''; }
    else if (sortKey === 'createdAt') { aVal = a.createdAt; bVal = b.createdAt; }

    return sortDir === 'asc'
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortIcon = (key: SortKey) => (
    <span className={`${styles.sortIcon} ${sortKey === key ? styles.sortIconActive : ''}`}>
      {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const handleRoleConfirm = async (userId: string, role: UserRole) => {
    await onRoleChange(userId, role);
    setRoleModalUser(null);
  };

  const handleDeleteConfirm = (userId: string) => {
    onDelete(userId);
    setDeleteConfirmId(null);
  };

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.table} aria-label="Users table">
          <thead className={styles.tableHead}>
            <tr>
              <th
                className={styles.thSortable}
                onClick={() => handleSort('username')}
                aria-sort={ariaSort('username', sortKey, sortDir)}
              >
                Username {sortIcon('username')}
              </th>
              <th
                className={styles.thSortable}
                onClick={() => handleSort('email')}
                aria-sort={ariaSort('email', sortKey, sortDir)}
              >
                Email {sortIcon('email')}
              </th>
              <th
                className={styles.thSortable}
                onClick={() => handleSort('role')}
                aria-sort={ariaSort('role', sortKey, sortDir)}
              >
                Role {sortIcon('role')}
              </th>
              <th>Status</th>
              <th
                className={styles.thSortable}
                onClick={() => handleSort('lastLogin')}
                aria-sort={ariaSort('lastLogin', sortKey, sortDir)}
              >
                Last Login {sortIcon('lastLogin')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody className={styles.tableBody}>
            {isLoading
              ? // skeleton rows while data is loading
                [...Array(5)].map((_, i) => (
                  <tr key={i} className={styles.skeletonRow}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j}>
                        <div className={styles.skeletonLine} style={{ width: `${60 + j * 5}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : paginated.length === 0
              ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>
                      <span className={styles.emptyStateIcon}>👤</span>
                      <span>No users found.</span>
                    </div>
                  </td>
                </tr>
              )
              : paginated.map((user) => {
                  const isActive = user.isActive;

                  return (
                    <React.Fragment key={user.id}>
                      <tr>
                        <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                          {user.username}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>
                          {user.email}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${
                            user.role === 'admin' ? styles.badgeAdmin :
                            user.role === 'manager' ? styles.badgeManager :
                            styles.badgeEmployee
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${
                            isActive ? styles.badgeActive : styles.badgeInactive
                          }`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                          {formatDate(user.lastLogin)}
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {/* edit role */}
                            <button
                              className={styles.actionBtn}
                              onClick={() => setRoleModalUser(user)}
                              title="Change role"
                              aria-label={`Change role for ${user.username}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            {/* deactivate / activate toggle */}
                            {isActive ? (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => onDeactivate(user.id)}
                                title="Deactivate user"
                                aria-label={`Deactivate ${user.username}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                                onClick={() => onActivate(user.id)}
                                title="Activate user"
                                aria-label={`Activate ${user.username}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                            )}

                            {/* delete — requires confirmation */}
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => setDeleteConfirmId(user.id)}
                              title="Delete user"
                              aria-label={`Delete ${user.username}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* inline delete confirmation row */}
                      {deleteConfirmId === user.id && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={6}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontSize: '14px', color: 'var(--color-error)', fontWeight: 500 }}>
                                Delete <strong>{user.username}</strong>? This action cannot be undone.
                              </span>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteConfirm(user.id)}
                              >
                                Delete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
          </tbody>
        </table>

        {/* pagination */}
        {!isLoading && sorted.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–
              {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} users
            </span>
            <div className={styles.paginationButtons}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage(1)}
                disabled={page === 1}
                aria-label="First page"
              >
                «
              </button>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className={`${styles.pageBtn} ${styles.pageBtnActive}`}>
                {page}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                ›
              </button>
              <button
                className={styles.pageBtn}
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                aria-label="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* role assignment modal */}
      {roleModalUser && (
        <RoleAssignment
          user={roleModalUser}
          onConfirm={handleRoleConfirm}
          onCancel={() => setRoleModalUser(null)}
        />
      )}
    </>
  );
}

export default UserTable;
