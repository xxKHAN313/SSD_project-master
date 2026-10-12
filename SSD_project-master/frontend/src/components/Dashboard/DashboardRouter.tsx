/**
 * @fileoverview Dashboard router component.
 * Reads the current user's role from useAuth and renders the correct dashboard.
 * Wrapped in MainLayout so all dashboards share the same shell.
 */

import React from 'react';
import MainLayout from '../Layout/MainLayout';
import EmployeeDashboard from './EmployeeDashboard';
import ManagerDashboard from './ManagerDashboard';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../Common/Loading';

export function DashboardRouter(): JSX.Element {
  const { user, isLoading, isAdmin, isManager } = useAuth();

  // still verifying session on initial load
  if (isLoading || !user) {
    return (
      <MainLayout>
        <Loading size="lg" text="Loading dashboard..." />
      </MainLayout>
    );
  }

  // render the dashboard that matches the user's role
  const renderDashboard = () => {
    if (isAdmin) return <AdminDashboard />;
    if (isManager) return <ManagerDashboard />;
    return <EmployeeDashboard />;
  };

  return <MainLayout>{renderDashboard()}</MainLayout>;
}

export default DashboardRouter;
