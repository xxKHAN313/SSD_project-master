/**
 * @fileoverview Role assignment modal component.
 * Lets an admin change a user's role with a confirmation warning about session revocation.
 */

import React, { useState } from 'react';
import styles from './Admin.module.css';
import Button from '../Common/Button';
import { UserProfile } from '../../types';
import { UserRole } from '../../types/auth';

interface RoleAssignmentProps {
  user: UserProfile;
  onConfirm: (userId: string, role: UserRole) => Promise<void>;
  onCancel: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export function RoleAssignment({ user, onConfirm, onCancel }: RoleAssignmentProps): JSX.Element {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [isLoading, setIsLoading] = useState(false);

  const isUnchanged = selectedRole === user.role;

  const handleConfirm = async () => {
    if (isUnchanged) return;
    setIsLoading(true);
    try {
      await onConfirm(user.id, selectedRole);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
      <div className={styles.modalCard}>
        <div>
          <h2 className={styles.modalTitle} id="role-modal-title">
            Change User Role
          </h2>
          <p className={styles.modalSubtitle}>
            Update the role for <strong>{user.username}</strong> ({user.email}).
          </p>
        </div>

        {/* current role indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>Current role:</span>
          <span className={`${styles.badge} ${
            user.role === 'admin' ? styles.badgeAdmin :
            user.role === 'manager' ? styles.badgeManager :
            styles.badgeEmployee
          }`}>
            {user.role}
          </span>
        </div>

        {/* role selector */}
        <div>
          <label
            htmlFor="role-select"
            style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-text-primary)' }}
          >
            New Role
          </label>
          <select
            id="role-select"
            className={styles.filterSelect}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* session revocation warning — shown only when the role is changing */}
        {!isUnchanged && (
          <div className={styles.warningBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              This will revoke all active sessions for this user. They will need to
              sign in again to access the system with the new role.
            </span>
          </div>
        )}

        {/* action buttons */}
        <div className={styles.modalActions}>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isUnchanged}
            loading={isLoading}
          >
            Confirm Change
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RoleAssignment;
