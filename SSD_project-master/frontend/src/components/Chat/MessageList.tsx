/**
 * @fileoverview Scrollable message list component.
 * Renders message bubbles, date separators, avatar initials, and pagination.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import styles from './Chat.module.css';
import { useChatContext } from '../../store/chatContext';
import { useAuth } from '../../hooks/useAuth';
import chatService from '../../services/chatService';
import { useAppContext } from '../../store/appContext';
import { Message } from '../../types';

// generate a deterministic avatar background from username
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

// return the date portion of a timestamp for separator grouping
function toDateKey(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// friendly time like "2:34 PM"
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MessageList(): JSX.Element {
  const { messages, activeRoom, hasMoreMessages, isLoadingMessages, prependMessages, setHasMoreMessages } = useChatContext();
  const { user } = useAuth();
  const { addToast } = useAppContext();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // track scroll height before prepending so we can restore position
  const prevScrollHeightRef = useRef<number>(0);

  // auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom || messages[messages.length - 1]?.senderId === user?.id) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, user?.id]);

  const loadMore = useCallback(async () => {
    if (!activeRoom || isLoadingMessages || !hasMoreMessages) return;

    // calculate the current page from message count (20 per page)
    const nextPage = Math.floor(messages.length / 20) + 1;
    const el = listRef.current;
    if (el) prevScrollHeightRef.current = el.scrollHeight;

    try {
      const resp = await chatService.getMessages(activeRoom.id, nextPage);
      prependMessages(resp.messages);
      setHasMoreMessages(resp.hasMore);

      // restore scroll position so the view doesn't jump to the top
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
        }
      });
    } catch {
      addToast('error', 'Failed to load older messages.');
    }
  }, [activeRoom, isLoadingMessages, hasMoreMessages, messages.length, prependMessages, setHasMoreMessages, addToast]);

  if (!activeRoom) return <div className={styles.messageList} />;

  // group messages by date to render separators
  const messageElements: JSX.Element[] = [];
  let lastDateKey = '';

  messages.forEach((msg: Message) => {
    const dateKey = toDateKey(msg.timestamp);
    const isOwn = msg.senderId === user?.id;

    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      messageElements.push(
        <div key={`sep-${dateKey}`} className={styles.dateSeparator}>
          <div className={styles.dateSeparatorLine} />
          <span>{dateKey}</span>
          <div className={styles.dateSeparatorLine} />
        </div>
      );
    }

    messageElements.push(
      <div
        key={msg.id}
        className={`${styles.messageRow} ${isOwn ? styles.messageRowOwn : ''}`}
      >
        {/* only show avatar for messages from others */}
        {!isOwn && (
          <div
            className={styles.avatar}
            style={{ background: avatarColor(msg.senderUsername) }}
            aria-hidden="true"
            title={msg.senderUsername}
          >
            {msg.senderUsername.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className={styles.messageBubble}>
          {/* show sender name above the bubble for received messages */}
          {!isOwn && !msg.isDeleted && (
            <span className={styles.messageSender}>{msg.senderUsername}</span>
          )}

          <div
            className={`${styles.messageContent} ${
              isOwn ? styles.messageContentSent : styles.messageContentReceived
            } ${msg.isDeleted ? styles.messageDeleted : ''}`}
          >
            {msg.isDeleted ? 'Message deleted' : msg.content}
          </div>

          <span className={styles.messageTime}>
            {formatTime(msg.timestamp)}
            {msg.editedAt && ' (edited)'}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div className={styles.messageList} ref={listRef}>
      {/* load more button at the top for pagination */}
      {hasMoreMessages && (
        <button
          className={styles.loadMoreButton}
          onClick={loadMore}
          disabled={isLoadingMessages}
        >
          {isLoadingMessages ? 'Loading...' : 'Load older messages'}
        </button>
      )}

      {messages.length === 0 && !isLoadingMessages && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            gap: '8px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '32px' }}>💬</span>
          <span>No messages yet. Say hello!</span>
        </div>
      )}

      {messageElements}
      {/* invisible anchor used for auto-scroll to bottom */}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
