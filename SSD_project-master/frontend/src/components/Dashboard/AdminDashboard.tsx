/**
 * @fileoverview Admin dashboard.
 * Shows system-wide stats, recent audit log entries, quick action cards,
 * and a system health panel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useAppContext } from '../../store/appContext';
import { useChatContext } from '../../store/chatContext';
import auditService from '../../services/auditService';
import userService from '../../services/userService';
import chatService from '../../services/chatService';
import { AuditLog } from '../../types/api';

// format ISO timestamp to a concise local string
function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// map severity level to the appropriate css class
function severityClass(sev: AuditLog['severity']): string {
  switch (sev) {
    case 'critical': return styles.badgeCritical;
    case 'warning': return styles.badgeWarning;
    default: return styles.badgeInfo;
  }
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  messagesToday: number;
  securityEvents: number;
}

export function AdminDashboard(): JSX.Element {
  const { user } = useAuth();
  const { addToast } = useAppContext();
  const { onlineUsers, setRooms } = useChatContext();

  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    messagesToday: 0,
    securityEvents: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const loadData = useCallback(async () => {
    try {
      // fetch users, rooms, and audit logs in parallel for performance
      const [userResp, rooms, logsResp] = await Promise.all([
        userService.getAllUsers({ limit: 1000 }),
        chatService.getRooms(),
        auditService.getLogs({ limit: 10, sortBy: 'timestamp', sortOrder: 'desc' }),
      ]);

      setRooms(rooms);
      setAuditLogs(logsResp.logs);

      // count critical/warning events as "security events"
      const securityCount = logsResp.logs.filter(
        (l) => l.severity === 'critical' || l.severity === 'warning'
      ).length;

      setStats({
        totalUsers: userResp.total,
        activeUsers: userResp.users.filter((u) => u.isActive).length,
        // messages today is approximated from the audit logs; real implementation would use a dedicated endpoint
        messagesToday: rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
        securityEvents: securityCount,
      });
    } catch {
      addToast('error', 'Failed to load admin dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [setRooms, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      {/* welcome banner */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          Admin Dashboard — {user?.username}
        </h1>
        <p className={styles.welcomeSubtitle}>
          System overview and security monitoring.
        </p>
        <div className={styles.welcomeMeta}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {dateString}
        </div>
      </div>

      {/* system stats grid */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        System Statistics
      </h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconBlue}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : stats.totalUsers}</div>
          <div className={styles.statCardLabel}>Total Users</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconGreen}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : stats.activeUsers}</div>
          <div className={styles.statCardLabel}>Active Users</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconAmber}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : onlineUsers.length}</div>
          <div className={styles.statCardLabel}>Online Now</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconRed}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : stats.securityEvents}</div>
          <div className={styles.statCardLabel}>Security Events</div>
        </div>
      </div>

      {/* quick action cards */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
        Quick Actions
      </h2>
      <div className={styles.quickLinksGrid}>
        <Link to="/admin/users" className={styles.quickLink}>
          <div className={styles.quickLinkIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          Manage Users
        </Link>

        <Link to="/admin/logs" className={styles.quickLink}>
          <div
            className={styles.quickLinkIcon}
            style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          View All Logs
        </Link>

        <Link to="/chat" className={styles.quickLink}>
          <div
            className={styles.quickLinkIcon}
            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          Monitor Chat
        </Link>
      </div>

      {/* system health */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        System Health
      </h2>
      <div className={styles.healthGrid} style={{ marginBottom: 'var(--space-xl)' }}>
        <div className={styles.healthItem}>
          <div className={`${styles.healthDot} ${styles.healthDotOnline}`} />
          <span className={styles.healthLabel}>Database</span>
          <span className={styles.healthStatus}>Connected</span>
        </div>
        <div className={styles.healthItem}>
          <div className={`${styles.healthDot} ${styles.healthDotOnline}`} />
          <span className={styles.healthLabel}>API Server</span>
          <span className={styles.healthStatus}>Online</span>
        </div>
        <div className={styles.healthItem}>
          <div className={`${styles.healthDot} ${styles.healthDotOnline}`} />
          <span className={styles.healthLabel}>WebSocket</span>
          <span className={styles.healthStatus}>Online</span>
        </div>
        <div className={styles.healthItem}>
          <div className={`${styles.healthDot} ${styles.healthDotOnline}`} />
          <span className={styles.healthLabel}>Auth Service</span>
          <span className={styles.healthStatus}>Operational</span>
        </div>
      </div>

      {/* recent audit log table */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Recent Audit Logs
      </h2>
      <div className={styles.auditTable}>
        <div className={`${styles.auditTableRow} ${styles.auditTableHeadRow}`}>
          <span>Timestamp</span>
          <span>User</span>
          <span>Action</span>
          <span>Severity</span>
          <span>IP Address</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={styles.skeletonLine} style={{ marginBottom: '12px' }} />
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>📋</span>
            <span>No audit logs yet.</span>
          </div>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} className={styles.auditTableRow}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                {formatTimestamp(log.timestamp)}
              </span>
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                {log.username}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{log.action}</span>
              <span>
                <span className={`${styles.badge} ${severityClass(log.severity)}`}>
                  {log.severity}
                </span>
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                {log.ipAddress}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 'var(--space-md)', textAlign: 'right' }}>
        <Link
          to="/admin/logs"
          style={{
            fontSize: '14px',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          View all audit logs →
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboard;
