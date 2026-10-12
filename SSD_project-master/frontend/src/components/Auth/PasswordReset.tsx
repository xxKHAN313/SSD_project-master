/**
 * @fileoverview Password reset page.
 * Reads the reset token from the URL, accepts a new password + confirm,
 * and redirects to /login after 3 seconds on success.
 */

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import styles from './Auth.module.css';
import AuthLayout from '../Layout/AuthLayout';
import Input from '../Common/Input';
import Button from '../Common/Button';
import authService from '../../services/authService';
import { useAppContext } from '../../store/appContext';
import {
  validatePassword,
  validatePasswordMatch,
  validatePasswordStrength,
} from '../../utils/validators';

interface ResetFormState {
  password: string;
  confirmPassword: string;
}

interface ResetFormErrors {
  password?: string;
  confirmPassword?: string;
}

const STRENGTH_LABELS: Record<string, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very Strong',
};

const STRENGTH_WIDTHS: Record<string, string> = {
  weak: '25%',
  fair: '50%',
  strong: '75%',
  'very-strong': '100%',
};

// countdown in seconds before redirecting to login after success
const REDIRECT_DELAY = 3;

export function PasswordReset(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { addToast } = useAppContext();

  const [form, setForm] = useState<ResetFormState>({
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ResetFormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_DELAY);

  const passwordStrength = validatePasswordStrength(form.password);

  // start the redirect countdown after a successful reset
  useEffect(() => {
    if (!success) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [success, navigate]);

  const handleChange = (field: keyof ResetFormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (globalError) setGlobalError(null);
  };

  const validateForm = (): boolean => {
    const errors: ResetFormErrors = {};

    const passwordErr = validatePassword(form.password);
    if (passwordErr) errors.password = passwordErr;

    const confirmErr = validatePasswordMatch(form.password, form.confirmPassword);
    if (confirmErr) errors.confirmPassword = confirmErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!token) {
      setGlobalError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }

    setIsLoading(true);
    setGlobalError(null);

    try {
      await authService.resetPassword(token, form.password, form.confirmPassword);
      addToast('success', 'Password reset successfully. You can now sign in.');
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Password reset failed. The link may have expired.';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // missing or clearly malformed token guard
  if (!token) {
    return (
      <AuthLayout subtitle="Reset your password">
        <div className={styles.successState}>
          <div
            className={styles.successIcon}
            style={{ background: 'var(--color-error-light)' }}
            aria-hidden="true"
          >
            ❌
          </div>
          <h1 className={styles.successTitle}>Invalid Reset Link</h1>
          <p className={styles.successMessage}>
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Link
            to="/forgot-password"
            style={{
              fontSize: '14px',
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Request New Reset Link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle="Set your new password"
      footerText="Remember your password?"
      footerLinkText="Back to Sign In"
      footerLinkHref="/login"
    >
      {success ? (
        /* success state with countdown */
        <div className={styles.successState}>
          <div className={styles.successIcon} aria-hidden="true">
            ✅
          </div>
          <h1 className={styles.successTitle}>Password Reset!</h1>
          <p className={styles.successMessage}>
            Your password has been updated successfully. You will be redirected
            to the login page in{' '}
            <strong>{countdown} second{countdown !== 1 ? 's' : ''}</strong>.
          </p>
          <Link
            to="/login"
            style={{
              fontSize: '14px',
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go to Sign In now →
          </Link>
        </div>
      ) : (
        <form
          className={styles.authForm}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Password reset form"
        >
          <div>
            <h1 className={styles.authFormTitle}>Set new password</h1>
            <p className={styles.authFormSubtitle}>
              Choose a strong password you haven't used before.
            </p>
          </div>

          {globalError && (
            <div className={styles.errorAlert} role="alert">
              <span className={styles.errorAlertIcon} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </span>
              {globalError}
            </div>
          )}

          <div>
            <Input
              label="New Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              error={fieldErrors.password}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              disabled={isLoading}
              iconLeft={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
            />

            {form.password.length > 0 && (
              <div className={styles.strengthContainer}>
                <div className={styles.strengthBar}>
                  <div
                    className={styles.strengthBarFill}
                    style={{
                      width: STRENGTH_WIDTHS[passwordStrength.strength],
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </div>
                <span
                  className={styles.strengthLabel}
                  style={{ color: passwordStrength.color }}
                >
                  {STRENGTH_LABELS[passwordStrength.strength]}
                </span>
                {passwordStrength.strength !== 'very-strong' &&
                  passwordStrength.suggestions.length > 0 && (
                    <ul className={styles.strengthSuggestions}>
                      {passwordStrength.suggestions.slice(0, 3).map((s) => (
                        <li key={s} className={styles.strengthSuggestion}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            )}
          </div>

          <Input
            label="Confirm New Password"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={fieldErrors.confirmPassword}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            required
            disabled={isLoading}
            iconLeft={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />

          <div className={styles.submitSection}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
            >
              Reset Password
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default PasswordReset;
