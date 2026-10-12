/**
 * @fileoverview Employee dashboard.
 * Shows welcome message, stat cards, quick navigation links, and recent messages.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useChatContext } from '../../store/chatContext';
import { useAppContext } from '../../store/appContext';
import chatService from '../../services/chatService';
import { Message, ChatRoom } from '../../types';

// generate a consistent avatar background color from a username string
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

// format a timestamp as a friendly relative string
function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EmployeeDashboard(): JSX.Element {
  const { user } = useAuth();
  const { addToast } = useAppContext();
  const { rooms, onlineUsers, setRooms } = useChatContext();

  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // total unread count across all rooms
  const totalUnread = rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0);

  const loadRoomsAndMessages = useCallback(async () => {
    try {
      setIsLoadingRooms(true);
      const fetchedRooms: ChatRoom[] = await chatService.getRooms();
      setRooms(fetchedRooms);

      // collect the last message from each room as a simple recent feed
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
      setIsLoadingRooms(false);
      setIsLoadingMessages(false);
    }
  }, [setRooms, addToast]);

  useEffect(() => {
    loadRoomsAndMessages();
  }, [loadRoomsAndMessages]);

  return (
    <div>
      {/* welcome banner */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          Welcome back, {user?.username ?? 'there'}!
        </h1>
        <p className={styles.welcomeSubtitle}>
          Your secure workspace is ready.
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

      {/* stat cards */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Overview
      </h2>
      <div className={styles.statsGrid}>
        {/* unread messages */}
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconBlue}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className={styles.statCardValue}>
            {isLoadingRooms ? '—' : totalUnread}
          </div>
          <div className={styles.statCardLabel}>Unread Messages</div>
          {!isLoadingRooms && totalUnread > 0 && (
            <span className={styles.statCardBadge}>{totalUnread} new</span>
          )}
        </div>

        {/* online users */}
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

        {/* available rooms */}
        <div className={styles.statCard}>
          <div className={`${styles.statCardIcon} ${styles.statCardIconAmber}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className={styles.statCardValue}>
            {isLoadingRooms ? '—' : rooms.length}
          </div>
          <div className={styles.statCardLabel}>Available Rooms</div>
        </div>
      </div>

      {/* quick links */}
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
      </div>

      {/* recent messages section */}
      <h2 className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Recent Messages
      </h2>
      <div className={styles.recentSection}>
        <div className={styles.recentSectionHeader}>
          <span className={styles.recentSectionTitle}>Latest activity across your rooms</span>
          <Link to="/chat" className={styles.recentSectionLink}>
            View all →
          </Link>
        </div>

        {isLoadingMessages ? (
          <div style={{ padding: 'var(--space-lg)' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={styles.skeletonLine}
                style={{ marginBottom: '12px', width: `${70 + i * 10}%` }}
              />
            ))}
          </div>
        ) : recentMessages.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>💬</span>
            <span>No messages yet. Join a room and start chatting!</span>
          </div>
        ) : (
          recentMessages.map((msg) => {
            // find the room name for this message
            const room = rooms.find((r) => r.id === msg.roomId);
            const initials = msg.senderUsername.slice(0, 2).toUpperCase();

            return (
              <div key={msg.id} className={styles.recentMessageItem}>
                <div
                  className={styles.recentMessageAvatar}
                  style={{ background: avatarColor(msg.senderUsername) }}
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className={styles.recentMessageContent}>
                  <div className={styles.recentMessageMeta}>
                    <span className={styles.recentMessageSender}>
                      {msg.senderUsername}
                    </span>
                    {room && (
                      <span className={styles.recentMessageRoom}>
                        in #{room.name}
                      </span>
                    )}
                    <span className={styles.recentMessageTime}>
                      {formatRelativeTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className={styles.recentMessageText}>
                    {msg.isDeleted ? (
                      <em style={{ color: 'var(--color-text-muted)' }}>
                        Message deleted
                      </em>
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

export default EmployeeDashboard;
