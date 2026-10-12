/**
 * @fileoverview Chat API service.
 * Wraps all chat-related endpoints: rooms, messages, and message management.
 */

import api from './api';
import {
  ChatRoom,
  Message,
  CreateRoomData,
  MessageListResponse,
} from '../types';

/**
 * Raw message shape returned from the backend API.
 * The backend uses `createdAt` while the frontend Message type uses `timestamp`.
 */
interface BackendMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  isDeleted: boolean;
  createdAt: string | Date;
  editedAt?: string | Date | null;
}

/**
 * Normalises a backend message DTO to the frontend Message interface.
 */
function normalizeMessage(msg: BackendMessage): Message {
  return {
    id: msg.id,
    roomId: msg.roomId,
    senderId: msg.senderId,
    senderUsername: msg.senderUsername,
    content: msg.content,
    isDeleted: msg.isDeleted,
    timestamp: typeof msg.createdAt === 'string' ? msg.createdAt : (msg.createdAt as Date).toISOString(),
    editedAt: msg.editedAt
      ? typeof msg.editedAt === 'string'
        ? msg.editedAt
        : (msg.editedAt as Date).toISOString()
      : null,
  };
}

const chatService = {
  /**
   * Fetch all chat rooms the current user has access to.
   * Backend returns { success: true, data: { rooms: RoomDto[] } }
   */
  async getRooms(): Promise<ChatRoom[]> {
    const response = await api.get<{ success: boolean; data: { rooms: ChatRoom[] } }>(
      '/chat/rooms'
    );
    return response.data.data.rooms as ChatRoom[];
  },

  /**
   * Create a new chat room. Requires manager or admin role.
   * Backend returns { success: true, data: { room: RoomDto } }
   */
  async createRoom(data: CreateRoomData): Promise<ChatRoom> {
    const response = await api.post<{ success: boolean; data: { room: ChatRoom } }>(
      '/chat/rooms',
      data
    );
    return response.data.data.room as ChatRoom;
  },

  /**
   * Fetch paginated message history for a specific room.
   * Backend returns { success: true, data: { messages, total, page, totalPages } }
   */
  async getMessages(
    roomId: string,
    page = 1,
    limit = 20
  ): Promise<MessageListResponse> {
    const response = await api.get<{
      success: boolean;
      data: { messages: BackendMessage[]; total: number; page: number; totalPages: number };
    }>(`/chat/rooms/${roomId}/messages`, {
      params: { page, limit },
    });
    const { messages, total, page: pg, totalPages } = response.data.data;
    return {
      messages: messages.map(normalizeMessage),
      total,
      page: pg,
      limit,
      hasMore: pg < totalPages,
    } as MessageListResponse;
  },

  /**
   * Send a new message to a room via the REST API.
   * Backend returns { success: true, data: { message: MessageDto } }
   */
  async sendMessage(roomId: string, content: string): Promise<Message> {
    const response = await api.post<{ success: boolean; data: { message: BackendMessage } }>(
      `/chat/rooms/${roomId}/messages`,
      { content }
    );
    return normalizeMessage(response.data.data.message);
  },

  /**
   * Soft-delete a message by id. Admins and the message author can delete.
   */
  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/chat/messages/${messageId}`);
  },

  /**
   * Get a specific room's details by id.
   */
  async getRoom(roomId: string): Promise<ChatRoom> {
    const response = await api.get<{ success: boolean; data: ChatRoom }>(
      `/chat/rooms/${roomId}`
    );
    return response.data.data as ChatRoom;
  },

  /**
   * Add a member to a room. Requires manager or admin role.
   */
  async addMember(roomId: string, userId: string): Promise<ChatRoom> {
    const response = await api.post<{ success: boolean; data: ChatRoom }>(
      `/chat/rooms/${roomId}/members`,
      { userId }
    );
    return response.data.data as ChatRoom;
  },

  /**
   * Remove a member from a room. Requires manager or admin role.
   */
  async removeMember(roomId: string, userId: string): Promise<ChatRoom> {
    const response = await api.delete<{ success: boolean; data: ChatRoom }>(
      `/chat/rooms/${roomId}/members/${userId}`
    );
    return response.data.data as ChatRoom;
  },
};

export default chatService;
