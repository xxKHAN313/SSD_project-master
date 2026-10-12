/**
 * @fileoverview Loading spinner component.
 * Supports size variants (sm/md/lg), an optional text label,
 * and a full-screen overlay mode for global loading states.
 */

import React from 'react';
import styles from './Common.module.css';

export type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingProps {
  size?: LoadingSize;
  // descriptive text shown beneath the spinner
  text?: string;
  // when true, renders as a fixed full-screen overlay with a blurred background
  overlay?: boolean;
  className?: string;
}

const spinnerSizeMap: Record<LoadingSize, string> = {
  sm: styles.loadingSpinnerSm,
  md: styles.loadingSpinnerMd,
  lg: styles.loadingSpinnerLg,
};

export function Loading({
  size = 'md',
  text,
  overlay = false,
  className,
}: LoadingProps): JSX.Element {
  const spinner = (
    <div
      className={`${styles.loadingContainer} ${className ?? ''}`}
      role="status"
      aria-label={text || 'Loading...'}
    >
      <div
        className={`${styles.loadingSpinner} ${spinnerSizeMap[size]}`}
        aria-hidden="true"
      />
      {text && <p className={styles.loadingText}>{text}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div className={styles.loadingOverlay}>
        {spinner}
      </div>
    );
  }

  return spinner;
}

export default Loading;
