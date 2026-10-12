/**
 * @fileoverview Forgot password page.
 * Accepts an email address and triggers a backend password reset email.
 * After submission shows a generic success message to prevent user enumeration.
 */

import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import styles from './Auth.module.css';
import AuthLayout from '../Layout/AuthLayout';
import Input from '../Common/Input';
import Button from '../Common/Button';
import authService from '../../services/authService';
import { validateEmail } from '../../utils/validators';

export function ForgotPassword(): JSX.Element {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // once the request succeeds, switch to the success state view
  const [submitted, setSubmitted] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(undefined);
    if (globalError) setGlobalError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // client-side format check before hitting the api
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }

    setIsLoading(true);
    setGlobalError(null);

    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      // always show success regardless of whether the email exists (prevents enumeration)
      setSubmitted(true);
    } catch (err: unknown) {
      // still show success on error to prevent user enumeration via timing/error differences
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Recover your account access"
      footerText="Remember your password?"
      footerLinkText="Back to Sign In"
      footerLinkHref="/login"
    >
      {submitted ? (
        /* success state — shown after the request completes */
        <div className={styles.successState}>
          <div className={styles.successIcon} aria-hidden="true">
            ✉️
          </div>
          <h1 className={styles.successTitle}>Check your email</h1>
          <p className={styles.successMessage}>
            If an account exists for <strong>{email}</strong>, a password reset
            link was sent to that address. Check your inbox and follow the
            instructions.
          </p>
          <Link
            to="/login"
            style={{
              fontSize: '14px',
              color: 'var(--color-primary)',
              fontWeight: 'var(--font-weight-medium)',
              textDecoration: 'none',
            }}
          >
            ← Back to Sign In
          </Link>
        </div>
      ) : (
        <form
          className={styles.authForm}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Forgot password form"
        >
          <div>
            <h1 className={styles.authFormTitle}>Forgot password?</h1>
            <p className={styles.authFormSubtitle}>
              Enter the email address linked to your account and we'll send you
              a reset link.
            </p>
          </div>

          {/* global error fallback if we decide to expose it */}
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

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={handleEmailChange}
            error={emailError}
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

          <div className={styles.submitSection}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
            >
              Send Reset Link
            </Button>

            <Link
              to="/login"
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                paddingTop: '4px',
              }}
            >
              ← Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default ForgotPassword;
