/**
 * @fileoverview Root application component.
 * Sets up context providers and client-side routing for Shield-Chat.
 * Provider order: AppProvider (toasts/loading) > AuthProvider > ChatProvider.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/appContext';
import { AuthProvider } from './store/authContext';
import { ChatProvider } from './store/chatContext';

// auth pages (public)
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import PasswordReset from './components/Auth/PasswordReset';

// dashboard (role-gated, renders the correct variant based on role)
import DashboardRouter from './components/Dashboard/DashboardRouter';

// chat (authenticated, any role)
import ChatWindow from './components/Chat/ChatWindow';

// profile (authenticated, any role)
import Profile from './components/Profile/Profile';

// admin pages (admin role only)
import UserManagement from './components/Admin/UserManagement';
import AuditLogsViewer from './components/Admin/AuditLogsViewer';

// shared utilities
import ProtectedRoute from './components/Common/ProtectedRoute';
import NotFound from './components/Common/NotFound';
import { useAuth } from './hooks/useAuth';

// global styles applied once at the root
import './styles/global.css';
import './styles/animations.css';

interface GuardProps {
  children: React.ReactNode;
}

/**
 * Redirects already-authenticated users away from public auth pages.
 * Must be rendered inside AuthProvider so useAuth is available.
 */
function RedirectIfAuthenticated({ children }: GuardProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  // while session is being verified, render the child (avoids flash-redirect)
  if (isLoading) return <>{children}</>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * Inner router rendered inside all context providers.
 * Separated so hooks (useAuth) can be called safely.
 */
function AppRoutes(): JSX.Element {
  return (
    <Routes>
      {/* root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* --- public auth routes --- */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <Login />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <Register />
          </RedirectIfAuthenticated>
        }
      />
      {/* forgot/reset are always accessible (token-based security) */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<PasswordReset />} />

      {/* --- protected: any authenticated role --- */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatWindow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* --- protected: admin only --- */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AuditLogsViewer />
          </ProtectedRoute>
        }
      />

      {/* catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      {/* AppProvider outermost so auth failures can trigger toasts */}
      <AppProvider>
        <AuthProvider>
          {/* ChatProvider depends on AuthProvider for the socket auth token */}
          <ChatProvider>
            <AppRoutes />
          </ChatProvider>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
