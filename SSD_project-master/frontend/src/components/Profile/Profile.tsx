/**
 * @fileoverview User profile page.
 * Shows the authenticated user's profile details (username, email, role,
 * account status, last login, member since) and lets them change their
 * own password. Available to every authenticated role.
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../Layout/MainLayout';
import Input from '../Common/Input';
import Button from '../Common/Button';
import Loading from '../Common/Loading';
import dashStyles from '../Dashboard/Dashboard.module.css';
import authStyles from '../Auth/Auth.module.css';
import styles from './Profile.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../store/appContext';
import authService from '../../services/authService';
import { User } from '../../types';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

// reuse the validation rules the backend enforces so we can fail fast client-side
function validateNewPassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return undefined;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function avatarColor(username: string): string {
  const palette = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function Profile(): JSX.Element {
  const { user: authUser, logout } = useAuth();
  const { addToast } = useAppContext();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [form, setForm] = useState<ChangePasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // load the authoritative profile from the backend on mount so we get the
  // decrypted email, which isn't present in the cached auth state
  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const fresh = await authService.getMe();
        if (!cancelled) setProfile(fresh);
      } catch {
        if (!cancelled) {
          addToast('error', 'Failed to load profile information.');
        }
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const handleChange = (field: keyof ChangePasswordForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: ChangePasswordErrors = {};
    if (!form.currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }
    const newErr = validateNewPassword(form.newPassword);
    if (newErr) errors.newPassword = newErr;
    if (form.newPassword === form.currentPassword && form.newPassword) {
      errors.newPassword = 'New password must be different from your current password.';
    }
    if (form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);
      addToast('success', 'Password changed successfully. Please log in again.');
      // the server revoked all sessions — force a full client-side logout
      // so the user is redirected to login with a clean state
      await logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to change password.';
      addToast('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // show the loader inside the layout so the sidebar/header don't flicker
  if (isLoadingProfile) {
    return (
      <MainLayout>
        <Loading size="lg" text="Loading profile..." />
      </MainLayout>
    );
  }

  const displayUser = profile ?? authUser;

  if (!displayUser) {
    return (
      <MainLayout>
        <div className={dashStyles.emptyState}>
          <span>Unable to load profile information.</span>
        </div>
      </MainLayout>
    );
  }

  const initials = displayUser.username.slice(0, 2).toUpperCase();

  return (
    <MainLayout>
      {/* header banner with avatar and summary */}
      <div className={styles.profileHeader}>
        <div
          className={styles.profileAvatar}
          style={{ background: avatarColor(displayUser.username) }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className={styles.profileHeaderInfo}>
          <h1 className={styles.profileName}>{displayUser.username}</h1>
          <div className={styles.profileRoleRow}>
            <span className={`${styles.roleBadge} ${styles[`role_${displayUser.role}`]}`}>
              {displayUser.role}
            </span>
            <span
              className={`${styles.statusBadge} ${
                displayUser.isActive ? styles.statusActive : styles.statusInactive
              }`}
            >
              {displayUser.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className={styles.profileSubtitle}>
            Manage your account information and security settings.
          </p>
        </div>
      </div>

      {/* profile detail card */}
      <h2 className={dashStyles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Account Information
      </h2>

      <div className={styles.infoCard}>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Username</span>
            <span className={styles.infoValue}>{displayUser.username}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>
              {displayUser.email || <em style={{ color: 'var(--color-text-muted)' }}>Unavailable</em>}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Role</span>
            <span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>
              {displayUser.role}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.infoValue}>
              {displayUser.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Last Login</span>
            <span className={styles.infoValue}>{formatDate(displayUser.lastLogin)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Member Since</span>
            <span className={styles.infoValue}>{formatDate(displayUser.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* change password form */}
      <h2 className={dashStyles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Change Password
      </h2>

      <div className={styles.infoCard}>
        <form
          className={authStyles.authForm}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Change password form"
          style={{ maxWidth: 520 }}
        >
          <p className={styles.formHint}>
            Choose a strong password with at least 8 characters including
            uppercase, lowercase, a number, and a special character.
            You will be logged out on every device after a successful change.
          </p>

          <Input
            label="Current password"
            type="password"
            value={form.currentPassword}
            onChange={handleChange('currentPassword')}
            error={fieldErrors.currentPassword}
            placeholder="Enter your current password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
          />

          <Input
            label="New password"
            type="password"
            value={form.newPassword}
            onChange={handleChange('newPassword')}
            error={fieldErrors.newPassword}
            placeholder="Enter a new password"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
          />

          <Input
            label="Confirm new password"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={fieldErrors.confirmPassword}
            placeholder="Re-enter the new password"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
          />

          <div className={authStyles.submitSection}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
            >
              Change Password
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

export default Profile;
