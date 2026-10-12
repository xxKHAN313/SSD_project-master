/**
 * @fileoverview Reusable Input component.
 * Supports text, email, and password types with show/hide toggle.
 * Displays label, required indicator, error message, and helper text.
 */

import React, { InputHTMLAttributes, ReactNode, useState, useId } from 'react';
import styles from './Common.module.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'tel';
  error?: string;
  helperText?: string;
  // show an asterisk to mark the field as required
  required?: boolean;
  // icon node placed on the left inside the input
  iconLeft?: ReactNode;
  // icon node placed on the right inside the input (not for password - that's auto)
  iconRight?: ReactNode;
}

export function Input({
  label,
  type = 'text',
  error,
  helperText,
  required,
  iconLeft,
  iconRight,
  className,
  id,
  disabled,
  ...rest
}: InputProps): JSX.Element {
  // auto-generate a unique id for linking label and input via htmlFor
  const generatedId = useId();
  const inputId = id || generatedId;

  // track password visibility for the show/hide toggle
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const inputClassNames = [
    styles.input,
    error ? styles.inputError : '',
    iconLeft ? styles.inputWithLeftIcon : '',
    (iconRight || isPassword) ? styles.inputWithRightIcon : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.inputWrapper}>
      {/* label row */}
      {label && (
        <label htmlFor={inputId} className={styles.inputLabel}>
          {label}
          {required && (
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* input field with optional prefix/suffix icons */}
      <div className={styles.inputContainer}>
        {/* left decorative icon (e.g., mail icon, lock icon) */}
        {iconLeft && (
          <span className={styles.inputIconLeft} aria-hidden="true">
            {iconLeft}
          </span>
        )}

        <input
          id={inputId}
          type={resolvedType}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          required={required}
          className={inputClassNames}
          {...rest}
        />

        {/* password show/hide toggle button */}
        {isPassword && (
          <span className={styles.inputIconRight}>
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                // eye-off icon (password visible)
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                // eye icon (password hidden)
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </span>
        )}

        {/* right icon for non-password fields */}
        {!isPassword && iconRight && (
          <span className={styles.inputIconRight} aria-hidden="true">
            {iconRight}
          </span>
        )}
      </div>

      {/* error message shown below the input */}
      {error && (
        <span
          id={`${inputId}-error`}
          className={styles.inputErrorMessage}
          role="alert"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </span>
      )}

      {/* helper text shown below the input when there's no error */}
      {!error && helperText && (
        <span
          id={`${inputId}-helper`}
          className={styles.inputHelperText}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}

export default Input;
