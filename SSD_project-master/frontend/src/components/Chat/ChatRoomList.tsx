/**
 * @fileoverview Chat room list sidebar component.
 * Renders filterable room list, active room highlighting, and a new-room button.
 */

import React, { useState } from 'react';
import styles from './Chat.module.css';
import { useChatContext } from '../../store/chatContext';
import { useAuth } from '../../hooks/useAuth';
import { ChatRoom } from '../../types';

interface ChatRoomListProps {
  onRoomSelect: (room: ChatRoom) => void;
  onNewRoom?: () => void;
}

export function ChatRoomList({ onRoomSelect, onNewRoom }: ChatRoomListProps): JSX.Element {
  const { rooms, activeRoom } = useChatContext();
  const { canAccess } = useAuth();
  const [search, setSearch] = useState('');

  // filter rooms by search query (case-insensitive on name)
  const filteredRooms = search.trim()
    ? rooms.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    : rooms;

  // managers and admins can create new rooms
  const canCreateRoom = canAccess('create:rooms');

  return (
    <>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>Rooms</div>
        <input
          type="search"
          className={styles.sidebarSearch}
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search rooms"
        />
      </div>

      <div className={styles.roomList} role="list" aria-label="Chat rooms">
        {filteredRooms.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '14px',
            }}
          >
            {search ? 'No rooms match your search.' : 'No rooms available.'}
          </div>
        ) : (
          filteredRooms.map((room: ChatRoom) => {
            const isActive = activeRoom?.id === room.id;
            return (
              <div
                key={room.id}
                role="listitem"
                className={`${styles.roomItem} ${isActive ? styles.roomItemActive : ''}`}
                onClick={() => onRoomSelect(room)}
                onKeyDown={(e) => e.key === 'Enter' && onRoomSelect(room)}
                tabIndex={0}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Room: ${room.name}`}
              >
                <div className={styles.roomItemName}>
                  <span># {room.name}</span>
                  {room.unreadCount && room.unreadCount > 0 ? (
                    <span className={styles.roomUnreadBadge}>
                      {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </span>
                  ) : null}
                </div>
                {room.description && (
                  <div className={styles.roomItemDesc}>{room.description}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* new room button — only visible to users with room-creation permission */}
      {canCreateRoom && (
        <button
          className={styles.newRoomButton}
          onClick={onNewRoom}
          aria-label="Create new room"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          New Room
        </button>
      )}
    </>
  );
}

export default ChatRoomList;
