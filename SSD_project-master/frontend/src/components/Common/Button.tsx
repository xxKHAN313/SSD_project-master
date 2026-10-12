/**
 * @fileoverview Reusable Button component.
 * Supports multiple visual variants, sizes, loading/disabled states, and icon slots.
 * Used throughout the application as the primary interactive element.
 */

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // show a spinner and disable interaction while true
  loading?: boolean;
  // stretch to fill parent width
  fullWidth?: boolean;
  // icon rendered before the label text
  iconLeft?: ReactNode;
  // icon rendered after the label text
  iconRight?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const isDisabled = disabled || loading;

  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={classNames}
      aria-busy={loading}
      {...rest}
    >
      {/* loading spinner replaces or accompanies the icon */}
      {loading ? (
        <span className={styles.loadingSpinner} aria-hidden="true">
          <span className={styles.spinner} />
        </span>
      ) : iconLeft ? (
        <span className={styles.iconLeft} aria-hidden="true">
          {iconLeft}
        </span>
      ) : null}

      {/* button label - visually hidden while loading but kept for accessibility */}
      {children && (
        <span>{loading ? (children) : children}</span>
      )}

      {/* right-side icon (only shown when not loading) */}
      {!loading && iconRight && (
        <span className={styles.iconRight} aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}

export default Button;
