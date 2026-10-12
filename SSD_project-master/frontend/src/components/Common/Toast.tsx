/**
 * @fileoverview Toast notification components.
 * Renders individual toast messages and a container that manages the stack.
 * Toasts auto-dismiss and can be manually closed. Rendered into the document body via portal.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import styles from './Common.module.css';
import { Toast as ToastType, useAppContext } from '../../store/appContext';

// icon mapping for each toast type
const TOAST_ICONS: Record<ToastType['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_STYLE_MAP: Record<
  ToastType['type'],
  string
> = {
  success: styles.toastSuccess,
  error: styles.toastError,
  warning: styles.toastWarning,
  info: styles.toastInfo,
};

// --- Individual Toast ---

interface ToastItemProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps): JSX.Element {
  const toastClassNames = [styles.toast, TOAST_STYLE_MAP[toast.type]]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={toastClassNames}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      {/* type icon */}
      <span className={styles.toastIcon} aria-hidden="true">
        {TOAST_ICONS[toast.type]}
      </span>

      {/* message content */}
      <div className={styles.toastContent}>
        <p className={styles.toastMessage}>{toast.message}</p>
      </div>

      {/* dismiss button */}
      <button
        className={styles.toastDismiss}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// --- Toast Container ---
// renders the stack of active toasts into a portal at the top-right of the screen

export function ToastContainer(): JSX.Element {
  const { toasts, removeToast } = useAppContext();

  if (toasts.length === 0) return <></>;

  return createPortal(
    <div className={styles.toastContainer} aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>,
    document.body
  );
}

export default ToastContainer;
