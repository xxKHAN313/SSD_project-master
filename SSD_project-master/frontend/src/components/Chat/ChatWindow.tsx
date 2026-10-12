/**
 * @fileoverview Main chat interface component.
 * Split layout: 280px sidebar (room list) + flexible message area.
 * Manages room selection, message loading, and socket integration.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Chat.module.css';
import ChatRoomList from './ChatRoomList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import CreateRoomModal from './CreateRoomModal';
import { useChatContext } from '../../store/chatContext';
import { useAppContext } from '../../store/appContext';
import { useSocket } from '../../hooks/useSocket';
import chatService from '../../services/chatService';
import { ChatRoom } from '../../types';

export function ChatWindow(): JSX.Element {
  const {
    activeRoom,
    typingUsers,
    onlineUsers,
    setActiveRoom,
    setMessages,
    setHasMoreMessages,
    setRooms,
    setLoadingMessages,
    isLoadingMessages,
  } = useChatContext();

  const { addToast } = useAppContext();
  const navigate = useNavigate();
  // useSocket wires up all socket event listeners and exposes emitters
  useSocket();

  // controls whether the sidebar is visible on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // toggles the "Create room" modal (managers + admins only)
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);

  // load rooms on mount so the sidebar has data
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const rooms = await chatService.getRooms();
        setRooms(rooms);
      } catch {
        addToast('error', 'Failed to load chat rooms.');
      }
    };
    loadRooms();
  }, [setRooms, addToast]);

  const handleRoomSelect = useCallback(
    async (room: ChatRoom) => {
      if (activeRoom?.id === room.id) {
        setIsSidebarOpen(false);
        return;
      }

      setActiveRoom(room);
      setIsSidebarOpen(false);
      setLoadingMessages(true);

      try {
        // load the first page of messages for the selected room
        const resp = await chatService.getMessages(room.id, 1);
        setMessages(resp.messages);
        setHasMoreMessages(resp.hasMore);
      } catch {
        addToast('error', 'Failed to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeRoom, setActiveRoom, setMessages, setHasMoreMessages, setLoadingMessages, addToast]
  );

  const handleNewRoom = () => {
    setIsCreateRoomOpen(true);
  };

  // when a new room is created, prepend it to the sidebar list and select it
  // so the user lands inside their new room immediately.
  const handleRoomCreated = useCallback(
    async (room: ChatRoom) => {
      try {
        // re-fetch the full list so any server-side role filtering is applied
        const refreshed = await chatService.getRooms();
        setRooms(refreshed);
      } catch {
        // non-fatal — the local room object is still valid to select
      }
      setActiveRoom(room);
      setMessages([]);
      setHasMoreMessages(false);
    },
    [setRooms, setActiveRoom, setMessages, setHasMoreMessages]
  );

  return (
    <div className={styles.chatWindow}>
      {/* mobile overlay closes the sidebar when tapping outside */}
      {isSidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* left sidebar */}
      <div className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <ChatRoomList onRoomSelect={handleRoomSelect} onNewRoom={handleNewRoom} />
      </div>

      {/* right message area */}
      <div className={styles.messageArea}>
        {/* top bar with room title and online count */}
        <div className={styles.messageAreaHeader}>
          {/* back button — returns to dashboard. Always visible (not just mobile)
              so the chat page is never a dead-end. */}
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className={styles.backButtonLabel}>Back</span>
          </button>

          {/* hamburger only visible on mobile */}
          <button
            className={styles.hamburger}
            onClick={() => setIsSidebarOpen((v) => !v)}
            aria-label="Toggle room list"
            aria-expanded={isSidebarOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {activeRoom ? (
            <>
              <span className={styles.roomName}>#{activeRoom.name}</span>
              <span className={styles.onlineCount}>
                <span className={styles.onlineDot} aria-hidden="true" />
                {onlineUsers.length} online
              </span>
            </>
          ) : (
            <span className={styles.roomName} style={{ color: 'var(--color-text-muted)' }}>
              Select a room
            </span>
          )}
        </div>

        {activeRoom ? (
          <>
            {/* scrollable message history */}
            {isLoadingMessages ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                Loading messages...
              </div>
            ) : (
              <MessageList />
            )}

            {/* typing indicator above the input */}
            <TypingIndicator typingUsers={typingUsers} />

            {/* message compose area */}
            <MessageInput />
          </>
        ) : (
          /* empty state when no room is selected */
          <div className={styles.noRoomPlaceholder}>
            <span className={styles.noRoomIcon} aria-hidden="true">💬</span>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Select a room to start chatting
            </h2>
            <p style={{ fontSize: '14px' }}>
              Choose a room from the sidebar on the left.
            </p>
          </div>
        )}
      </div>

      {/* create-room modal (rendered via portal) */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        onCreated={handleRoomCreated}
      />
    </div>
  );
}

export default ChatWindow;
