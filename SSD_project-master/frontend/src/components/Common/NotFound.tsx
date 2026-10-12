/**
 * @fileoverview Custom 404 Not Found page.
 * Shown when the user navigates to a route that doesn't exist.
 * Provides a friendly message and navigation back to the dashboard.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Common.module.css';
import { useAuth } from '../../hooks/useAuth';

export function NotFound(): JSX.Element {
  const { isAuthenticated } = useAuth();

  return (
    <div className={styles.notFoundPage}>
      {/* visual illustration - pure CSS circles and emoji */}
      <div className={styles.notFoundIllustration} aria-hidden="true">
        <div className={styles.notFoundCircle}>🔍</div>
      </div>

      {/* 404 number */}
      <div className={styles.notFound404} aria-hidden="true">
        404
      </div>

      {/* heading */}
      <h1 className={styles.notFoundTitle}>Page Not Found</h1>

      {/* descriptive message */}
      <p className={styles.notFoundDescription}>
        The page you're looking for doesn't exist or may have been moved.
        Double-check the URL or use the links below to get back on track.
      </p>

      {/* action buttons */}
      <div className={styles.notFoundActions}>
        {isAuthenticated ? (
          <>
            <Link
              to="/dashboard"
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Go to Dashboard
            </Link>
            <Link
              to="/chat"
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: 'var(--color-primary)',
                border: '2px solid var(--color-primary)',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Open Messages
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Sign In
          </Link>
        )}
      </div>

      {/* support contact */}
      <p
        style={{
          marginTop: '32px',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
        }}
      >
        Need help?{' '}
        <a
          href="mailto:support@shieldchat.example"
          style={{ color: 'var(--color-primary)' }}
        >
          Contact Support
        </a>
      </p>
    </div>
  );
}

export default NotFound;
