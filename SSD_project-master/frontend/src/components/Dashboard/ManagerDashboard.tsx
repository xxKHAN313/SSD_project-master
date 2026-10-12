/**
 * @fileoverview Manager dashboard.
 * Extends the employee dashboard with team stats, team-specific rooms,
 * and an export button for message history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useChatContext } from '../../store/chatContext';
import { useAppContext } from '../../store/appContext';
import chatService from '../../services/chatService';
import auditService from '../../services/auditService';
import { ChatRoom, Message } from '../../types';

function avatarColor(username: string): string {
  const palette = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// trigger a browser download from a blob
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ManagerDashboard(): JSX.Element {
  const { user } = useAuth();
  const { addToast } = useAppContext();
  const { rooms, onlineUsers, setRooms } = useChatContext();

  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalUnread = rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0);
  // count rooms with active recent messages as "active chats"
  const activeChats = rooms.filter((r) => r.lastMessage).length;

  const loadData = useCallback(async () => {
    try {
      const fetchedRooms: ChatRoom[] = await chatService.getRooms();
      setRooms(fetchedRooms);

      const last: Message[] = fetchedRooms
        .filter((r) => r.lastMessage)
        .map((r) => r.lastMessage as Message)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5);

      setRecentMessages(last);
    } catch {
      addToast('error', 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [setRooms, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await auditService.exportLogs('csv');
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `message-history-${date}.csv`);
      addToast('success', 'Message history exported successfully.');
    } catch {
      addToast('error', 'Failed to export message history.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      {/* welcome banner */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          Welcome back, {user?.username ?? 'Manager'}!
        </h1>
        <p className={styles.welcomeSubtitle}>
          Manage your team and monitor activity.
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

      {/* stat cards — includes manager-specific team cards */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Overview
      </h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconBlue}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : totalUnread}</div>
          <div className={styles.statCardLabel}>Unread Messages</div>
          {!isLoading && totalUnread > 0 && (
            <span className={styles.statCardBadge}>{totalUnread} new</span>
          )}
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconGreen}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{onlineUsers.length}</div>
          <div className={styles.statCardLabel}>Online Now</div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconAmber}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : rooms.length}</div>
          <div className={styles.statCardLabel}>Total Rooms</div>
        </div>

        {/* manager-specific: active chats count */}
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconPurple}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 7 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 7 23 7 23 13" />
            </svg>
          </div>
          <div className={styles.statCardValue}>{isLoading ? '—' : activeChats}</div>
          <div className={styles.statCardLabel}>Active Chats</div>
        </div>
      </div>

      {/* quick actions including export */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
        Quick Actions
      </h2>
      <div className={styles.quickLinksGrid}>
        <Link to="/chat" className={styles.quickLink}>
          <div className={styles.quickLinkIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          Go to Chat
        </Link>

        <Link to="/profile" className={styles.quickLink}>
          <div className={styles.quickLinkIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          View Profile
        </Link>

        {/* export message history — calls auditService to download a CSV */}
        <button
          className={styles.quickLink}
          onClick={handleExport}
          disabled={isExporting}
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', cursor: isExporting ? 'not-allowed' : 'pointer' }}
        >
          <div
            className={styles.quickLinkIcon}
            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          {isExporting ? 'Exporting...' : 'Export History'}
        </button>
      </div>

      {/* team-specific rooms section */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Your Rooms
      </h2>
      <div className={styles.recentSection}>
        <div className={styles.recentSectionHeader}>
          <span className={styles.recentSectionTitle}>Rooms you manage</span>
          <Link to="/chat" className={styles.recentSectionLink}>
            Open chat →
          </Link>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeletonLine} style={{ marginBottom: '12px', width: '60%' }} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>🏠</span>
            <span>No rooms available. Create one in the chat section.</span>
          </div>
        ) : (
          rooms.slice(0, 5).map((room: ChatRoom) => (
            <div key={room.id} className={styles.recentMessageItem}>
              <div
                className={styles.recentMessageAvatar}
                style={{ background: avatarColor(room.name), fontSize: '12px' }}
                aria-hidden="true"
              >
                {room.name.slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.recentMessageContent}>
                <div className={styles.recentMessageMeta}>
                  <span className={styles.recentMessageSender}>{room.name}</span>
                  <span className={styles.recentMessageRoom}>
                    {room.allowedRoles?.length ?? 0} role{(room.allowedRoles?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {room.lastMessage && (
                    <span className={styles.recentMessageTime}>
                      {formatRelativeTime(room.lastMessage.timestamp)}
                    </span>
                  )}
                </div>
                <div className={styles.recentMessageText}>{room.description}</div>
              </div>
              {room.unreadCount && room.unreadCount > 0 ? (
                <span className={styles.statCardBadge}>{room.unreadCount}</span>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* recent messages feed */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Recent Activity
      </h2>
      <div className={styles.recentSection}>
        <div className={styles.recentSectionHeader}>
          <span className={styles.recentSectionTitle}>Latest messages</span>
          <Link to="/chat" className={styles.recentSectionLink}>View all →</Link>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeletonLine} style={{ marginBottom: '12px', width: `${65 + i * 10}%` }} />
            ))}
          </div>
        ) : recentMessages.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>💬</span>
            <span>No recent messages.</span>
          </div>
        ) : (
          recentMessages.map((msg) => {
            const room = rooms.find((r) => r.id === msg.roomId);
            return (
              <div key={msg.id} className={styles.recentMessageItem}>
                <div
                  className={styles.recentMessageAvatar}
                  style={{ background: avatarColor(msg.senderUsername) }}
                  aria-hidden="true"
                >
                  {msg.senderUsername.slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.recentMessageContent}>
                  <div className={styles.recentMessageMeta}>
                    <span className={styles.recentMessageSender}>{msg.senderUsername}</span>
                    {room && <span className={styles.recentMessageRoom}>in #{room.name}</span>}
                    <span className={styles.recentMessageTime}>{formatRelativeTime(msg.timestamp)}</span>
                  </div>
                  <div className={styles.recentMessageText}>
                    {msg.isDeleted ? (
                      <em style={{ color: 'var(--color-text-muted)' }}>Message deleted</em>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ManagerDashboard;
