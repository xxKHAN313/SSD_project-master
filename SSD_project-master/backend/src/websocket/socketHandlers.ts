/**
 * socketHandlers.ts
 *
 * Socket.io event handlers for real-time chat functionality.
 * registered per-socket after authentication is confirmed.
 *
 * events handled:
 * - join-room: verify access and subscribe the socket to a room channel
 * - leave-room: unsubscribe from a room channel
 * - send-message: encrypt, persist, and broadcast a chat message
 * - typing: broadcast typing indicator to room members
 * - stop-typing: remove typing indicator
 * - disconnect: clean up typing state and broadcast offline status
 */

import { Socket, Server } from 'socket.io';
import { ChatRoom } from '../models/ChatRoom';
import { sendMessage } from '../services/chatService';
import { logger } from '../utils/logger';
import type { UserRole } from '../config/constants';
import type { Request } from 'express';

// module-level map tracking which users are currently typing in each room.
// roomId -> Set of usernames currently typing
// this state is in-memory and resets on server restart (acceptable for UX indicators).
const typingUsers: Map<string, Set<string>> = new Map();

/**
 * registers all socket event handlers for a single authenticated connection.
 * called once from socketManager when a socket connects successfully.
 *
 * @param io - the Socket.io server instance (for broadcasting to rooms)
 * @param socket - the authenticated socket connection
 */
export function registerSocketHandlers(io: Server, socket: Socket): void {
  const userId = socket.data['userId'] as string;
  const role = socket.data['role'] as UserRole;
  const username = socket.data['username'] as string;

  // -----------------------------------------------------------------------
  // JOIN ROOM
  // verifies the user's role has access to the room, then subscribes them.
  // -----------------------------------------------------------------------
  socket.on('join-room', async (roomId: string) => {
    try {
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
      if (!room) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      if (!room.allowedRoles.includes(role)) {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      await socket.join(roomId);

      // notify others in the room that this user has joined
      socket.to(roomId).emit('user-joined', { userId, username });

      logger.debug('[socketHandlers] user joined room', { userId, username, roomId });
    } catch (err) {
      logger.error('[socketHandlers] join-room error', {
        error: (err as Error).message,
        userId,
        roomId,
      });
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // -----------------------------------------------------------------------
  // LEAVE ROOM
  // unsubscribes the socket from the room channel and clears typing state.
  // -----------------------------------------------------------------------
  socket.on('leave-room', (roomId: string) => {
    if (!roomId || typeof roomId !== 'string') return;

    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId, username });

    // clear any active typing indicator for this user in the room
    const typing = typingUsers.get(roomId);
    if (typing && typing.has(username)) {
      typing.delete(username);
      io.to(roomId).emit('typing-update', { typingUsers: Array.from(typing) });
    }

    logger.debug('[socketHandlers] user left room', { userId, username, roomId });
  });

  // -----------------------------------------------------------------------
  // SEND MESSAGE
  // saves the message via chatService (which encrypts and audits it),
  // then broadcasts the decrypted DTO to all sockets in the room.
  // -----------------------------------------------------------------------
  socket.on('send-message', async (data: { roomId: string; content: string }) => {
    try {
      if (!data || !data.roomId || !data.content) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      const { roomId, content } = data;

      // construct a minimal mock request object so chatService can log the audit entry.
      // the socket connection provides IP and user-agent; the rest is from socket.data.
      const mockReq = {
        ip: socket.handshake.address,
        headers: {
          'user-agent': socket.handshake.headers['user-agent'] ?? 'socket.io-client',
        },
        user: { userId, role, username },
      } as unknown as Request;

      const message = await sendMessage(roomId, userId, role, username, content, mockReq);

      // broadcast to all users in the room including the sender (using io.to, not socket.to)
      io.to(roomId).emit('message-received', message);
    } catch (err) {
      logger.error('[socketHandlers] send-message error', {
        error: (err as Error).message,
        userId,
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // -----------------------------------------------------------------------
  // TYPING INDICATOR
  // broadcasts to other room members that this user is typing.
  // -----------------------------------------------------------------------
  socket.on('typing', (roomId: string) => {
    if (!roomId || typeof roomId !== 'string') return;

    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Set());
    }

    const typing = typingUsers.get(roomId)!;
    typing.add(username);

    // broadcast to all OTHER sockets in the room (not sender)
    socket.to(roomId).emit('typing-update', { typingUsers: Array.from(typing) });
  });

  // -----------------------------------------------------------------------
  // STOP TYPING
  // removes the user from the typing set and broadcasts the update.
  // -----------------------------------------------------------------------
  socket.on('stop-typing', (roomId: string) => {
    if (!roomId || typeof roomId !== 'string') return;

    const typing = typingUsers.get(roomId);
    if (typing && typing.has(username)) {
      typing.delete(username);
      socket.to(roomId).emit('typing-update', { typingUsers: Array.from(typing) });
    }
  });

  // -----------------------------------------------------------------------
  // DISCONNECT
  // cleans up typing state across all rooms and logs the event.
  // note: the socketManager registers an additional disconnect handler
  // to manage the onlineUsers map and emit user-offline events.
  // -----------------------------------------------------------------------
  socket.on('disconnect', () => {
    // remove this user from all active typing maps
    typingUsers.forEach((users, roomId) => {
      if (users.has(username)) {
        users.delete(username);
        // notify remaining room members
        io.to(roomId).emit('typing-update', { typingUsers: Array.from(users) });
      }
    });

    logger.debug('[socketHandlers] user disconnected', { userId, username });
  });
}
