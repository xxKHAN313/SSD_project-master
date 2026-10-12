/**
 * @fileoverview Collapsible sidebar navigation component.
 * Shows role-filtered navigation links with active state highlighting.
 * Supports desktop collapse mode and mobile overlay mode.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Common.module.css';
import { useRole } from '../../hooks/useRole';

interface NavItem {
  label: string;
  path: string;
  icon: JSX.Element;
  // optional role requirement - omit if all roles can see this item
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    label: 'Messages',
    path: '/chat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'User Management',
    path: '/admin/users',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    adminOnly: true,
  },
  {
    label: 'Audit Logs',
    path: '/admin/logs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    adminOnly: true,
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  isCollapsed,
  onCollapseToggle,
  isMobileOpen,
  onMobileClose,
}: SidebarProps): JSX.Element {
  const { isAdmin, canViewAdminPanel } = useRole();

  const sidebarClassNames = [
    styles.sidebar,
    isCollapsed ? styles.sidebarCollapsed : '',
    isMobileOpen ? styles.sidebarMobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* mobile backdrop overlay - clicking it closes the sidebar */}
      {isMobileOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={sidebarClassNames} aria-label="Sidebar navigation">
        <nav className={styles.sidebarNav}>
          {/* main navigation section */}
          <div className={styles.sidebarSection}>
            {!isCollapsed && (
              <div className={styles.sidebarSectionTitle}>Main</div>
            )}
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [styles.sidebarLink, isActive ? styles.sidebarLinkActive : '']
                    .filter(Boolean)
                    .join(' ')
                }
                onClick={onMobileClose}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={styles.sidebarLinkIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span
                  className={[
                    styles.sidebarLinkText,
                    isCollapsed ? styles.sidebarLinkTextHidden : '',
                  ].join(' ')}
                >
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>

          {/* admin section - only rendered for admin role */}
          {canViewAdminPanel && (
            <div className={styles.sidebarSection}>
              {!isCollapsed && (
                <div className={styles.sidebarSectionTitle}>Admin</div>
              )}
              {ADMIN_NAV_ITEMS.filter((item) =>
                item.adminOnly ? isAdmin : true
              ).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    [styles.sidebarLink, isActive ? styles.sidebarLinkActive : '']
                      .filter(Boolean)
                      .join(' ')
                  }
                  onClick={onMobileClose}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className={styles.sidebarLinkIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span
                    className={[
                      styles.sidebarLinkText,
                      isCollapsed ? styles.sidebarLinkTextHidden : '',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* collapse toggle button at the bottom of the sidebar */}
        <button
          className={styles.sidebarCollapseBtn}
          onClick={onCollapseToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-slow)',
            }}
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {!isCollapsed && (
            <span style={{ marginLeft: '8px', fontSize: '14px' }}>Collapse</span>
          )}
        </button>
      </aside>
    </>
  );
}

export default Sidebar;
