/**
 * @fileoverview Main application layout.
 * Combines Navbar + Sidebar + scrollable main content area.
 * Manages sidebar collapse state and mobile overlay visibility.
 */

import React, { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import Navbar from '../Common/Navbar';
import Sidebar from '../Common/Sidebar';

// maps route paths to human-readable breadcrumb labels
const BREADCRUMB_LABELS: Record<string, string> = {
  '': 'Home',
  dashboard: 'Dashboard',
  chat: 'Messages',
  admin: 'Admin',
  users: 'User Management',
  logs: 'Audit Logs',
};

interface MainLayoutProps {
  children: ReactNode;
  // when true, removes padding from the content area (for full-bleed pages like chat)
  fullBleed?: boolean;
}

export function MainLayout({ children, fullBleed = false }: MainLayoutProps): JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // build breadcrumb items from the current pathname
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => ({
    label: BREADCRUMB_LABELS[segment] || segment,
    path: '/' + pathSegments.slice(0, index + 1).join('/'),
    isLast: index === pathSegments.length - 1,
  }));

  const handleSidebarCollapseToggle = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleMobileClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={styles.mainLayout}>
      {/* sticky top navigation bar */}
      <Navbar
        onMobileMenuToggle={handleMobileMenuToggle}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className={styles.mainBody}>
        {/* collapsible sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onCollapseToggle={handleSidebarCollapseToggle}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={handleMobileClose}
        />

        {/* main scrollable content area */}
        <main className={styles.mainContent} id="main-content">
          <div className={fullBleed ? styles.mainContentFull : styles.mainContentInner}>
            {/* breadcrumb navigation - not shown on full-bleed layouts */}
            {!fullBleed && breadcrumbs.length > 0 && (
              <nav
                className={styles.breadcrumbs}
                aria-label="Breadcrumb navigation"
              >
                <div className={styles.breadcrumbItem}>
                  <Link to="/dashboard" className={styles.breadcrumbLink}>
                    Home
                  </Link>
                </div>

                {breadcrumbs.map((crumb) => (
                  <div key={crumb.path} className={styles.breadcrumbItem}>
                    <span className={styles.breadcrumbSeparator} aria-hidden="true">
                      ›
                    </span>
                    {crumb.isLast ? (
                      <span
                        className={styles.breadcrumbCurrent}
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link to={crumb.path} className={styles.breadcrumbLink}>
                        {crumb.label}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
