/**
 * @fileoverview Reusable Modal dialog component.
 * Supports size variants, backdrop click to close, ESC key close,
 * custom footer with confirm/cancel buttons, and smooth animations.
 */

import React, { ReactNode, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Common.module.css';
import Button from './Button';

export type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  // footer action buttons
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  confirmVariant?: 'primary' | 'danger';
  // hide the footer entirely when you want custom footer content
  hideFooter?: boolean;
  size?: ModalSize;
  // prevent closing by clicking the backdrop
  disableBackdropClose?: boolean;
  footer?: ReactNode;
}

const sizeClassMap: Record<ModalSize, string> = {
  sm: styles.modalSm,
  md: styles.modalMd,
  lg: styles.modalLg,
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  confirmLoading = false,
  confirmVariant = 'primary',
  hideFooter = false,
  size = 'md',
  disableBackdropClose = false,
  footer,
}: ModalProps): JSX.Element | null {
  // close the modal when ESC is pressed
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // only close if the click was directly on the backdrop (not on the modal content)
    if (e.target === e.currentTarget && !disableBackdropClose) {
      onClose();
    }
  };

  const modalClassNames = [styles.modal, sizeClassMap[size]].join(' ');

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={modalClassNames}>
        {/* modal header */}
        {title && (
          <div className={styles.modalHeader}>
            <h2 id="modal-title" className={styles.modalTitle}>
              {title}
            </h2>
            <button
              className={styles.modalCloseButton}
              onClick={onClose}
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* modal body */}
        <div className={styles.modalBody}>{children}</div>

        {/* modal footer */}
        {!hideFooter && (
          <div className={styles.modalFooter}>
            {footer ? (
              footer
            ) : (
              <>
                <Button variant="secondary" onClick={onClose} disabled={confirmLoading}>
                  {cancelLabel}
                </Button>
                {onConfirm && (
                  <Button
                    variant={confirmVariant}
                    onClick={onConfirm}
                    loading={confirmLoading}
                  >
                    {confirmLabel}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
