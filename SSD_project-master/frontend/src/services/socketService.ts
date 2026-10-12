/**
 * @fileoverview WebSocket service singleton.
 * Wraps socket.io-client to provide a typed interface for all real-time events.
 * Used by the useSocket hook to bind events to React state.
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

// socket event names matching the backend implementation
const EVENTS = {
  // outbound (client → server) — must match socketHandlers.ts on the backend
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  SEND_MESSAGE: 'send-message',
  TYPING_START: 'typing',
  TYPING_STOP: 'stop-typing',

  // inbound (server → client) — must match what socketHandlers.ts emits
  MESSAGE: 'message-received',
  USER_TYPING: 'typing-update',
  USER_STOP_TYPING: 'typing-update',
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',
  ONLINE_USERS: 'online_users',
  ROOM_UPDATED: 'room_updated',
  MESSAGE_DELETED: 'message_deleted',
  ERROR: 'error',
} as const;

class SocketService {
  private socket: Socket | null = null;

  /**
   * Establish the websocket connection, authenticating with the access token.
   * The token is passed in the auth payload so the server can verify on handshake.
   */
  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      // connection established - the server will emit online_users shortly
    });

    this.socket.on('disconnect', (reason) => {
      // log disconnect reason in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    this.socket.on('connect_error', (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Socket] Connection error:', err.message);
      }
    });
  }

  /**
   * Gracefully close the socket connection.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Join a chat room to receive its messages and typing events.
   * Backend expects a plain roomId string.
   */
  joinRoom(roomId: string): void {
    this.socket?.emit(EVENTS.JOIN_ROOM, roomId);
  }

  /**
   * Leave a chat room - stops receiving events for it.
   * Backend expects a plain roomId string.
   */
  leaveRoom(roomId: string): void {
    this.socket?.emit(EVENTS.LEAVE_ROOM, roomId);
  }

  /**
   * Send a chat message through the websocket channel.
   * Backend expects { roomId, content } object.
   */
  sendMessage(roomId: string, content: string): void {
    this.socket?.emit(EVENTS.SEND_MESSAGE, { roomId, content });
  }

  /**
   * Notify the server (and other users) that this user started typing.
   * Backend expects a plain roomId string.
   */
  emitTyping(roomId: string): void {
    this.socket?.emit(EVENTS.TYPING_START, roomId);
  }

  /**
   * Notify the server that this user stopped typing.
   * Backend expects a plain roomId string.
   */
  emitStopTyping(roomId: string): void {
    this.socket?.emit(EVENTS.TYPING_STOP, roomId);
  }

  // --- event subscription methods ---
  // each returns a cleanup function to unsubscribe when the component unmounts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage(callback: (message: any) => void): () => void {
    this.socket?.on(EVENTS.MESSAGE, callback);
    return () => this.socket?.off(EVENTS.MESSAGE, callback);
  }

  /**
   * Backend emits 'typing-update' with { typingUsers: string[] } — list of
   * all usernames currently typing in the room.
   */
  onTypingUpdate(callback: (data: { typingUsers: string[] }) => void): () => void {
    this.socket?.on(EVENTS.USER_TYPING, callback);
    return () => this.socket?.off(EVENTS.USER_TYPING, callback);
  }

  /** @deprecated Use onTypingUpdate instead */
  onTyping(callback: (data: { username: string; roomId: string }) => void): () => void {
    return this.onTypingUpdate(callback as never);
  }

  /** @deprecated Use onTypingUpdate instead */
  onStopTyping(callback: (data: { username: string; roomId: string }) => void): () => void {
    return this.onTypingUpdate(callback as never);
  }

  /**
   * Backend emits 'user-online' with { userId, username }.
   */
  onUserOnline(callback: (data: { userId: string; username: string }) => void): () => void {
    this.socket?.on(EVENTS.USER_ONLINE, callback);
    return () => this.socket?.off(EVENTS.USER_ONLINE, callback);
  }

  /**
   * Backend emits 'user-offline' with { userId, username }.
   */
  onUserOffline(callback: (data: { userId: string; username: string }) => void): () => void {
    this.socket?.on(EVENTS.USER_OFFLINE, callback);
    return () => this.socket?.off(EVENTS.USER_OFFLINE, callback);
  }

  onOnlineUsers(callback: (userIds: string[]) => void): () => void {
    this.socket?.on(EVENTS.ONLINE_USERS, callback);
    return () => this.socket?.off(EVENTS.ONLINE_USERS, callback);
  }

  onMessageDeleted(callback: (messageId: string) => void): () => void {
    this.socket?.on(EVENTS.MESSAGE_DELETED, callback);
    return () => this.socket?.off(EVENTS.MESSAGE_DELETED, callback);
  }

  onError(callback: (error: { message: string }) => void): () => void {
    this.socket?.on(EVENTS.ERROR, callback);
    return () => this.socket?.off(EVENTS.ERROR, callback);
  }

  /**
   * Remove ALL event listeners from the socket.
   * Used during cleanup when the user logs out.
   */
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  /**
   * Check if the socket is currently connected.
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get the socket id (for debugging/logging).
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// export as a singleton - one socket connection for the entire app
const socketService = new SocketService();
export default socketService;
