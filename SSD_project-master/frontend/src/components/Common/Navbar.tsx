/**
 * @fileoverview Top navigation bar component.
 * Displays the Shield-Chat brand, current user info with role badge,
 * a user dropdown menu (profile, logout), and a hamburger menu for mobile.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Common.module.css';
import { useAuth } from '../../hooks/useAuth';
import { generateAvatarColor, getInitials, getRoleColor } from '../../utils/helpers';

interface NavbarProps {
  onMobileMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

export function Navbar({ onMobileMenuToggle, isMobileMenuOpen }: NavbarProps): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // close dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const avatarColor = user ? generateAvatarColor(user.username) : '#2563EB';
  const initials = user ? getInitials(user.username) : '?';
  const roleColor = user ? getRoleColor(user.role) : '#6B7280';

  return (
    <nav className={styles.navbar} role="navigation" aria-label="Main navigation">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* hamburger menu button for mobile sidebar */}
        <button
          className={styles.hamburger}
          onClick={onMobileMenuToggle}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <span
            className={styles.hamburgerLine}
            style={isMobileMenuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}}
          />
          <span
            className={styles.hamburgerLine}
            style={isMobileMenuOpen ? { opacity: 0 } : {}}
          />
          <span
            className={styles.hamburgerLine}
            style={isMobileMenuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}}
          />
        </button>

        {/* brand logo and name */}
        <Link to="/dashboard" className={styles.navbarBrand}>
          <div className={styles.navbarBrandIcon} aria-hidden="true">
            🛡️
          </div>
          <span>Shield-Chat</span>
        </Link>
      </div>

      {/* right side: user info and dropdown */}
      <div className={styles.navbarRight}>
        {user && (
          <div className={styles.navbarUserMenu} ref={dropdownRef}>
            <button
              className={styles.navbarUserButton}
              onClick={() => setDropdownOpen((open) => !open)}
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
              aria-label={`User menu for ${user.username}`}
            >
              {/* avatar with user's initials */}
              <div
                className={styles.navbarAvatar}
                style={{ backgroundColor: avatarColor }}
                aria-hidden="true"
              >
                {initials}
              </div>

              {/* username and role badge (hidden on mobile) */}
              <div className={styles.navbarUserInfo}>
                <span className={styles.navbarUsername}>{user.username}</span>
                <span
                  className={styles.navbarRoleBadge}
                  style={{
                    backgroundColor: `${roleColor}18`,
                    color: roleColor,
                    border: `1px solid ${roleColor}40`,
                  }}
                >
                  {user.role}
                </span>
              </div>

              {/* chevron icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms ease',
                  color: 'var(--color-text-muted)',
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* dropdown menu */}
            {dropdownOpen && (
              <div
                className={styles.navbarDropdown}
                role="menu"
                aria-label="User menu"
              >
                {/* user info header in dropdown */}
                <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {user.username}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {user.email}
                  </div>
                </div>

                {/* navigation items */}
                <Link
                  to="/dashboard"
                  className={styles.navbarDropdownItem}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  Dashboard
                </Link>

                <Link
                  to="/chat"
                  className={styles.navbarDropdownItem}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Messages
                </Link>

                <div className={styles.navbarDropdownDivider} role="separator" />

                {/* logout button */}
                <button
                  className={`${styles.navbarDropdownItem} ${styles.danger}`}
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
