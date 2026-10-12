/**
 * @fileoverview Chat-related TypeScript interfaces.
 * Defines message, room, and related data structures for the chat system.
 */

// a single chat message as returned from the api or received via websocket
export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: string;
  // soft-deleted messages show a placeholder instead of content
  isDeleted: boolean;
  editedAt?: string | null;
}

// a chat room with its metadata and access configuration
export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  // roles allowed to access this room (returned by the backend)
  allowedRoles?: string[];
  // accessLevel: 'public' | 'manager' | 'admin'
  accessLevel?: string;
  isActive?: boolean;
  lastMessage?: Message | null;
  unreadCount?: number;
}

// payload when sending a new message to a room
export interface SendMessageData {
  roomId: string;
  content: string;
}

// payload when creating a new chat room
export interface CreateRoomData {
  name: string;
  description?: string;
  // 'public' = all roles, 'manager' = manager+admin, 'admin' = admin only
  accessLevel?: 'public' | 'manager' | 'admin';
}

// paginated message list for infinite scroll in the chat window
export interface MessageListResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
