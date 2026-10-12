/**
 * @fileoverview Authentication page layout.
 * Provides a centered card container on a dark gradient background.
 * Used for Login, Register, ForgotPassword, and PasswordReset pages.
 */

import React, { ReactNode } from 'react';
import styles from './Layout.module.css';
import { APP_NAME } from '../../config';

interface AuthLayoutProps {
  children: ReactNode;
  // text displayed below the brand name in the header
  subtitle?: string;
  // text and link shown in the card footer (e.g., "Already have an account? Sign in")
  footerText?: string;
  footerLinkText?: string;
  footerLinkHref?: string;
}

export function AuthLayout({
  children,
  subtitle = 'Secure Role-Based Messaging',
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthLayoutProps): JSX.Element {
  return (
    <div className={styles.authLayout}>
      <div className={styles.authCard}>
        {/* gradient brand header */}
        <div className={styles.authHeader}>
          <span className={styles.authBrandIcon} aria-hidden="true">
            🛡️
          </span>
          <div className={styles.authBrandName}>{APP_NAME}</div>
          <div className={styles.authBrandTagline}>{subtitle}</div>
        </div>

        {/* page-specific form content */}
        <div className={styles.authBody}>{children}</div>

        {/* optional footer link (sign in / register cross-links) */}
        {(footerText || footerLinkText) && (
          <div className={styles.authFooter}>
            {footerText && <span>{footerText} </span>}
            {footerLinkText && footerLinkHref && (
              <a href={footerLinkHref} className={styles.authFooterLink}>
                {footerLinkText}
              </a>
            )}
          </div>
        )}
      </div>

      {/* copyright below the card */}
      <p className={styles.authCopyright}>
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </p>
    </div>
  );
}

export default AuthLayout;
