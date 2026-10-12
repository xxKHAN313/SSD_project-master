/**
 * @fileoverview WebSocket hook.
 * Manages socket connection lifecycle tied to authentication state.
 * Bridges socket events to chat context state updates.
 * Handles typing indicator emission with debouncing.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useChatContext } from '../store/chatContext';
import socketService from '../services/socketService';
import { getAccessToken } from '../utils/tokenManager';
import { TYPING_TIMEOUT } from '../utils/constants';
import { Message } from '../types';

/**
 * Normalises a backend socket message payload to the frontend Message interface.
 * The backend emits `createdAt` but the frontend type uses `timestamp`.
 */
function normalizeSocketMessage(raw: Record<string, unknown>): Message {
  return {
    id: raw['id'] as string,
    roomId: raw['roomId'] as string,
    senderId: raw['senderId'] as string,
    senderUsername: raw['senderUsername'] as string,
    content: raw['content'] as string,
    isDeleted: (raw['isDeleted'] as boolean) ?? false,
    timestamp: (raw['timestamp'] as string) || (raw['createdAt'] as string) || new Date().toISOString(),
    editedAt: (raw['editedAt'] as string | null) ?? null,
  };
}

export function useSocket() {
  const { isAuthenticated, user } = useAuth();
  const {
    activeRoom,
    addMessage,
    deleteMessage,
    addTypingUser,
    removeTypingUser,
    setTypingUsers,
    addOnlineUser,
    removeOnlineUser,
    setOnlineUsers,
  } = useChatContext();

  // track typing timeout timer to clear it on re-emit
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // track if we are currently marked as typing
  const isTypingRef = useRef(false);

  // connect socket when user logs in, disconnect on logout
  useEffect(() => {
    if (isAuthenticated) {
      const token = getAccessToken();
      if (token) {
        socketService.connect(token);
      }
    } else {
      socketService.removeAllListeners();
      socketService.disconnect();
    }

    return () => {
      // clean up on unmount - this should only happen at app teardown
      if (!isAuthenticated) {
        socketService.removeAllListeners();
        socketService.disconnect();
      }
    };
  }, [isAuthenticated]);

  // bind socket event handlers after connection
  useEffect(() => {
    if (!isAuthenticated) return;

    // handle incoming chat messages from other users
    // normalise the backend payload (createdAt → timestamp) before adding to state
    const unsubMessage = socketService.onMessage((raw: unknown) => {
      const message = normalizeSocketMessage(raw as Record<string, unknown>);
      addMessage(message);
    });

    // handle typing update events — backend sends the full list of typing usernames
    const unsubTyping = socketService.onTypingUpdate(({ typingUsers }) => {
      setTypingUsers(typingUsers.filter((u) => u !== user?.username));
    });

    // no separate stop-typing event — typing-update covers both start and stop
    const unsubStopTyping = () => {}; // no-op, handled by onTypingUpdate above

    // handle user coming online — backend sends { userId, username }
    const unsubUserOnline = socketService.onUserOnline(({ userId }) => {
      addOnlineUser(userId);
    });

    // handle user going offline — backend sends { userId, username }
    const unsubUserOffline = socketService.onUserOffline(({ userId }) => {
      removeOnlineUser(userId);
    });

    // receive the initial list of online users when connecting
    const unsubOnlineUsers = socketService.onOnlineUsers((userIds: string[]) => {
      setOnlineUsers(userIds);
    });

    // handle server-side message deletion broadcasts
    const unsubMessageDeleted = socketService.onMessageDeleted((messageId: string) => {
      deleteMessage(messageId);
    });

    // cleanup: unsubscribe all listeners when effect re-runs
    return () => {
      unsubMessage();
      unsubTyping();
      unsubStopTyping();
      unsubUserOnline();
      unsubUserOffline();
      unsubOnlineUsers();
      unsubMessageDeleted();
    };
  }, [
    isAuthenticated,
    activeRoom?.id,
    user?.username,
    addMessage,
    deleteMessage,
    addTypingUser,
    removeTypingUser,
    setTypingUsers,
    addOnlineUser,
    removeOnlineUser,
    setOnlineUsers,
  ]);

  // join/leave rooms as the active room changes
  useEffect(() => {
    if (!isAuthenticated || !activeRoom) return;

    socketService.joinRoom(activeRoom.id);

    return () => {
      // leave the room when switching away or unmounting
      socketService.leaveRoom(activeRoom.id);

      // clear any pending typing state when leaving a room
      if (isTypingRef.current && activeRoom) {
        socketService.emitStopTyping(activeRoom.id);
        isTypingRef.current = false;
      }
    };
  }, [isAuthenticated, activeRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Emit a typing event with automatic stop-typing after TYPING_TIMEOUT ms.
   * Debounced: calling this rapidly only extends the timer, not spam events.
   */
  const emitTyping = useCallback(() => {
    if (!activeRoom) return;

    // only emit typing_start if we weren't already marked as typing
    if (!isTypingRef.current) {
      socketService.emitTyping(activeRoom.id);
      isTypingRef.current = true;
    }

    // reset the auto-stop timer on each keystroke
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      if (activeRoom && isTypingRef.current) {
        socketService.emitStopTyping(activeRoom.id);
        isTypingRef.current = false;
      }
    }, TYPING_TIMEOUT);
  }, [activeRoom]);

  /**
   * Immediately emit stop-typing (e.g., on message send or blur).
   */
  const emitStopTyping = useCallback(() => {
    if (!activeRoom) return;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (isTypingRef.current) {
      socketService.emitStopTyping(activeRoom.id);
      isTypingRef.current = false;
    }
  }, [activeRoom]);

  /**
   * Send a message through the websocket channel.
   */
  const sendSocketMessage = useCallback(
    (content: string) => {
      if (!activeRoom) return;
      emitStopTyping();
      socketService.sendMessage(activeRoom.id, content);
    },
    [activeRoom, emitStopTyping]
  );

  return {
    emitTyping,
    emitStopTyping,
    sendSocketMessage,
    isConnected: socketService.isConnected(),
  };
}

export default useSocket;
