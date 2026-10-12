/**
 * @fileoverview Route protection HOC/wrapper component.
 * Redirects unauthenticated users to /login.
 * Redirects authenticated users who lack the required role to /unauthorized.
 */

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import Loading from './Loading';

interface ProtectedRouteProps {
  children: ReactNode;
  // if provided, only users with one of these roles can access the route
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // show a loading spinner while the session is being verified on app start
  if (isLoading) {
    return (
      <Loading
        size="lg"
        text="Verifying session..."
        overlay
      />
    );
  }

  // redirect unauthenticated users to login, preserving the intended destination
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // check role-based access if allowedRoles is specified
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
}

// --- Inline unauthorized page ---
// shown when the user is authenticated but lacks the required role

function UnauthorizedPage(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '32px',
        textAlign: 'center',
        background: 'var(--color-bg-main)',
      }}
    >
      <div style={{ fontSize: '72px', marginBottom: '24px' }}>🔒</div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}
      >
        Access Denied
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: 'var(--color-text-secondary)',
          marginBottom: '32px',
          maxWidth: '400px',
          lineHeight: 1.6,
        }}
      >
        You do not have permission to view this page. Contact your administrator
        if you believe this is a mistake.
      </p>
      <a
        href="/dashboard"
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
        Back to Dashboard
      </a>
    </div>
  );
}

export default ProtectedRoute;
