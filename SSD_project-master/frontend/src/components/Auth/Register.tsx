/**
 * @fileoverview Registration page component.
 * Handles new account creation with username, email, password, and confirm password.
 * Shows password strength indicator and inline validation errors.
 */

import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';
import AuthLayout from '../Layout/AuthLayout';
import Input from '../Common/Input';
import Button from '../Common/Button';
import { useAppContext } from '../../store/appContext';
import authService from '../../services/authService';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validatePasswordMatch,
  validatePasswordStrength,
} from '../../utils/validators';

interface RegisterFormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// strength label text shown next to the bar
const STRENGTH_LABELS: Record<string, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very Strong',
};

// percentage widths for each strength level
const STRENGTH_WIDTHS: Record<string, string> = {
  weak: '25%',
  fair: '50%',
  strong: '75%',
  'very-strong': '100%',
};

export function Register(): JSX.Element {
  const { addToast } = useAppContext();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterFormState>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // compute password strength on every keystroke
  const passwordStrength = validatePasswordStrength(form.password);

  const handleChange = (field: keyof RegisterFormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    // clear the field error as the user types to avoid stale messages
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (globalError) setGlobalError(null);
  };

  const validateForm = (): boolean => {
    const errors: RegisterFormErrors = {};

    const usernameErr = validateUsername(form.username);
    if (usernameErr) errors.username = usernameErr;

    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;

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

    setIsLoading(true);
    setGlobalError(null);

    try {
      await authService.register({
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      addToast('success', 'Account created successfully! Please sign in.');
      // redirect to login with a success query param so the login page can show a notice
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Create your secure account"
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
    >
      <form
        className={styles.authForm}
        onSubmit={handleSubmit}
        noValidate
        aria-label="Registration form"
      >
        <div>
          <h1 className={styles.authFormTitle}>Create account</h1>
          <p className={styles.authFormSubtitle}>
            Join Shield-Chat to access your secure workspace.
          </p>
        </div>

        {/* global error banner shown when the api call fails */}
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

        {/* username — alphanumeric + underscore only */}
        <Input
          label="Username"
          type="text"
          value={form.username}
          onChange={handleChange('username')}
          error={fieldErrors.username}
          placeholder="your_username"
          autoComplete="username"
          required
          disabled={isLoading}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />

        {/* email address */}
        <Input
          label="Email Address"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
          error={fieldErrors.email}
          placeholder="you@company.com"
          autoComplete="email"
          required
          disabled={isLoading}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
        />

        {/* password with strength indicator below */}
        <div>
          <Input
            label="Password"
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

          {/* only show strength bar when the user has typed something */}
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
              {/* show improvement hints only when not already very strong */}
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

        {/* confirm password */}
        <Input
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange('confirmPassword')}
          error={fieldErrors.confirmPassword}
          placeholder="Re-enter your password"
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
            Create Account
          </Button>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          By creating an account, you agree to the Terms of Service and Privacy
          Policy.
        </p>
      </form>
    </AuthLayout>
  );
}

export default Register;
