/**
 * @fileoverview React Error Boundary component.
 * Catches synchronous render errors in its child tree.
 * Shows a friendly UI instead of a blank screen.
 * Logs error details to the console in development only.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import styles from './Common.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  // optional custom fallback UI
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // only log in development - never expose stack traces to production users
    if (process.env.NODE_ENV === 'development') {
      console.group('[ErrorBoundary] Unhandled render error');
      console.error('Error:', error);
      console.error('Component stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  handleRetry = () => {
    // reset error state to re-attempt rendering the children
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // default error UI
      return (
        <div className={styles.errorBoundary} role="alert">
          <div className={styles.errorBoundaryIcon} aria-hidden="true">
            ⚠️
          </div>
          <h2 className={styles.errorBoundaryTitle}>Something went wrong</h2>
          <p className={styles.errorBoundaryMessage}>
            An unexpected error occurred while rendering this section.
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <>
                {' '}
                <br />
                <code
                  style={{
                    fontSize: '12px',
                    backgroundColor: '#FEF2F2',
                    color: '#991B1B',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    marginTop: '8px',
                    display: 'inline-block',
                  }}
                >
                  {this.state.error.message}
                </code>
              </>
            )}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
