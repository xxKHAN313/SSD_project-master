/**
 * @fileoverview Login page component.
 * Handles user authentication with username + password, remember-me checkbox,
 * client-side validation, API error display, and redirect after success.
 */

import React, { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './Auth.module.css';
import AuthLayout from '../Layout/AuthLayout';
import Input from '../Common/Input';
import Button from '../Common/Button';
import { useAuth } from '../../hooks/useAuth';

interface LoginFormState {
  username: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormErrors {
  username?: string;
  password?: string;
}

export function Login(): JSX.Element {
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // redirect to the originally intended page after successful login
  const from = (location.state as { from?: string })?.from || '/dashboard';

  const [form, setForm] = useState<LoginFormState>({
    username: '',
    password: '',
    rememberMe: false,
  });

  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleChange = (field: keyof LoginFormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof LoginFormErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (error) clearError();
  };

  const validateForm = (): boolean => {
    const errors: LoginFormErrors = {};
    if (!form.username.trim()) errors.username = 'Username is required.';
    if (!form.password) errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      await login({
        username: form.username.trim(),
        password: form.password,
        rememberMe: form.rememberMe,
      });
      navigate(from, { replace: true });
    } catch {
      // error is set in auth context
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Sign in to your secure workspace"
      footerText="Don't have an account?"
      footerLinkText="Register"
      footerLinkHref="/register"
    >
      <form
        className={styles.authForm}
        onSubmit={handleSubmit}
        noValidate
        aria-label="Login form"
      >
        <div>
          <h1 className={styles.authFormTitle}>Welcome back</h1>
          <p className={styles.authFormSubtitle}>
            Enter your credentials to access Shield-Chat.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <span className={styles.errorAlertIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </span>
            {error}
          </div>
        )}

        {/* username field */}
        <Input
          label="Username"
          type="text"
          value={form.username}
          onChange={handleChange('username')}
          error={fieldErrors.username}
          placeholder="your_username"
          autoComplete="username"
          required
          disabled={submitLoading}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          }
        />

        {/* password field */}
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={handleChange('password')}
          error={fieldErrors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          disabled={submitLoading}
          iconLeft={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          }
        />

        {/* remember me + forgot password */}
        <div className={styles.authRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.rememberMe}
              onChange={handleChange('rememberMe')}
              disabled={submitLoading}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>
        </div>

        <div className={styles.submitSection}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitLoading || isLoading}
          >
            Sign In
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default Login;
