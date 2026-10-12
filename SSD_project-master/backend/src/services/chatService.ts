/**
 * chatService.ts
 *
 * chat room and message business logic.
 * messages are encrypted before storage and decrypted before delivery.
 * room access is enforced based on user role.
 */

import mongoose from 'mongoose';
import { Request } from 'express';
import { ChatRoom, IChatRoom, RoomAccessLevel } from '../models/ChatRoom';
import { Message, IMessage } from '../models/Message';
import { createLog } from './auditService';
import { encryptMessage, safeDecryptMessage } from './encryptionService';
import { AUDIT_ACTIONS, UserRole, ROLES } from '../config/constants';
import { logger } from '../utils/logger';
import { CHAT_ERRORS } from '../utils/errorMessages';
import { sanitizeString } from '../utils/sanitizers';
import { MAX_MESSAGE_LENGTH, MIN_MESSAGE_LENGTH, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../utils/constants';

/**
 * message DTO returned to clients.
 * content is decrypted before return.
 */
export interface MessageDto {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string; // decrypted
  isDeleted: boolean;
  createdAt: Date;
  editedAt: Date | null;
}

/**
 * room DTO returned to clients.
 */
export interface RoomDto {
  id: string;
  name: string;
  description: string;
  accessLevel: RoomAccessLevel;
  allowedRoles: UserRole[];
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * determines which roles can access a room based on the access level.
 */
function getRolesForAccessLevel(accessLevel: RoomAccessLevel): UserRole[] {
  switch (accessLevel) {
    case 'public':
      return [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN];
    case 'manager':
      return [ROLES.MANAGER, ROLES.ADMIN];
    case 'admin':
      return [ROLES.ADMIN];
    default:
      return [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN];
  }
}

/**
 * converts a ChatRoom document to a RoomDto.
 */
function toRoomDto(room: IChatRoom): RoomDto {
  return {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    accessLevel: room.accessLevel,
    allowedRoles: room.allowedRoles,
    createdBy: room.createdBy.toString(),
    isActive: room.isActive,
    createdAt: room.createdAt,
  };
}

/**
 * retrieves all chat rooms accessible to the given user's role.
 *
 * @param role - the authenticated user's role
 * @returns list of accessible rooms
 */
export async function getRooms(role: UserRole): Promise<RoomDto[]> {
  const rooms = await ChatRoom.findAccessibleByRole(role);
  return rooms.map(toRoomDto);
}

/**
 * creates a new chat room (admin/manager only).
 *
 * @param data - room creation data
 * @param creatorId - user ID of the creator
 * @param req - express request
 * @returns created RoomDto
 */
export async function createRoom(
  data: {
    name: string;
    description?: string;
    accessLevel?: RoomAccessLevel;
  },
  creatorId: string,
  req: Request
): Promise<RoomDto> {
  const accessLevel: RoomAccessLevel = data.accessLevel ?? 'public';
  const allowedRoles = getRolesForAccessLevel(accessLevel);

  const room = await ChatRoom.create({
    name: sanitizeString(data.name),
    description: data.description ? sanitizeString(data.description) : '',
    accessLevel,
    allowedRoles,
    createdBy: new mongoose.Types.ObjectId(creatorId),
  });

  await createLog({
    userId: creatorId,
    action: AUDIT_ACTIONS.ROOM_CREATED,
    targetId: room._id.toString(),
    targetType: 'ChatRoom',
    details: { name: room.name, accessLevel },
    req,
    success: true,
  });

  logger.info('[chatService] room created', { name: room.name, accessLevel });
  return toRoomDto(room);
}

/**
 * retrieves paginated messages for a room.
 * validates that the user's role can access the room before returning messages.
 * decrypts each message content before returning.
 *
 * @param roomId - the target room ID
 * @param role - authenticated user's role (for access check)
 * @param page - page number
 * @param limit - items per page
 * @returns paginated message list with decrypted content
 */
export async function getRoomMessages(
  roomId: string,
  role: UserRole,
  page = 1,
  limit = DEFAULT_PAGE_SIZE
): Promise<{ messages: MessageDto[]; total: number; page: number; totalPages: number }> {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw Object.assign(new Error(CHAT_ERRORS.ROOM_NOT_FOUND), { statusCode: 404 });
  }

  // verify room exists and user has access
  const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
  if (!room) {
    throw Object.assign(new Error(CHAT_ERRORS.ROOM_NOT_FOUND), { statusCode: 404 });
  }

  if (!room.allowedRoles.includes(role)) {
    throw Object.assign(new Error(CHAT_ERRORS.ACCESS_DENIED), { statusCode: 403 });
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

  const { messages, total } = await Message.findByRoom(roomId, safePage, safeLimit);

  const messageDtos: MessageDto[] = messages.map((msg) => {
    const sender = msg.senderId as unknown as { _id: mongoose.Types.ObjectId; username: string };
    return {
      id: msg._id.toString(),
      roomId: msg.roomId.toString(),
      senderId: typeof sender === 'object' ? sender._id.toString() : msg.senderId.toString(),
      senderUsername: typeof sender === 'object' ? sender.username : 'unknown',
      // decrypt content for delivery — only decrypted in memory, never stored as plaintext
      content: safeDecryptMessage(msg.encryptedContent),
      isDeleted: msg.isDeleted,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
    };
  });

  return {
    messages: messageDtos,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit),
  };
}

/**
 * sends a message to a chat room.
 * validates room access, sanitizes content, encrypts before storage.
 *
 * @param roomId - target room ID
 * @param userId - sender's user ID
 * @param role - sender's role (for access check)
 * @param username - sender's username (for response DTO)
 * @param content - raw message content
 * @param req - express request
 * @returns the created message DTO with decrypted content
 */
export async function sendMessage(
  roomId: string,
  userId: string,
  role: UserRole,
  username: string,
  content: string,
  req: Request
): Promise<MessageDto> {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw Object.assign(new Error(CHAT_ERRORS.ROOM_NOT_FOUND), { statusCode: 404 });
  }

  // sanitize message content (strip xss, null bytes)
  const sanitized = sanitizeString(content);

  if (sanitized.length < MIN_MESSAGE_LENGTH) {
    throw Object.assign(new Error(CHAT_ERRORS.MESSAGE_EMPTY), { statusCode: 400 });
  }
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    throw Object.assign(new Error(CHAT_ERRORS.MESSAGE_TOO_LONG), { statusCode: 400 });
  }

  // verify room access
  const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
  if (!room) {
    throw Object.assign(new Error(CHAT_ERRORS.ROOM_NOT_FOUND), { statusCode: 404 });
  }

  if (!room.allowedRoles.includes(role)) {
    throw Object.assign(new Error(CHAT_ERRORS.ACCESS_DENIED), { statusCode: 403 });
  }

  // encrypt message content before persisting
  const encryptedContent = encryptMessage(sanitized);

  const message = await Message.create({
    roomId: new mongoose.Types.ObjectId(roomId),
    senderId: new mongoose.Types.ObjectId(userId),
    encryptedContent,
  });

  await createLog({
    userId,
    action: AUDIT_ACTIONS.MESSAGE_SENT,
    targetId: message._id.toString(),
    targetType: 'Message',
    details: { roomId, messageLength: sanitized.length },
    req,
    success: true,
  });

  return {
    id: message._id.toString(),
    roomId,
    senderId: userId,
    senderUsername: username,
    content: sanitized, // return plaintext to the sender (already in memory)
    isDeleted: false,
    createdAt: message.createdAt,
    editedAt: null,
  };
}

/**
 * soft-deletes a message.
 * admins and managers can delete any message; employees can only delete their own.
 *
 * @param messageId - the message to delete
 * @param userId - requesting user's ID
 * @param role - requesting user's role
 * @param req - express request
 */
export async function deleteMessage(
  messageId: string,
  userId: string,
  role: UserRole,
  req: Request
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw Object.assign(new Error(CHAT_ERRORS.MESSAGE_NOT_FOUND), { statusCode: 404 });
  }

  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) {
    throw Object.assign(new Error(CHAT_ERRORS.MESSAGE_NOT_FOUND), { statusCode: 404 });
  }

  // employees can only delete their own messages
  const isOwn = message.senderId.toString() === userId;
  const canDeleteAny = role === ROLES.ADMIN || role === ROLES.MANAGER;

  if (!isOwn && !canDeleteAny) {
    throw Object.assign(new Error(CHAT_ERRORS.ACCESS_DENIED), { statusCode: 403 });
  }

  message.isDeleted = true;
  message.deletedBy = new mongoose.Types.ObjectId(userId);
  message.deletedAt = new Date();
  await message.save();

  await createLog({
    userId,
    action: AUDIT_ACTIONS.MESSAGE_DELETED,
    targetId: messageId,
    targetType: 'Message',
    details: { roomId: message.roomId.toString() },
    req,
    success: true,
  });

  logger.info('[chatService] message soft-deleted', { messageId, deletedBy: userId });
}

/**
 * searches for messages in a room by keyword.
 * decrypts each message for matching — this is an in-memory search operation.
 * for large scale, consider a separate search-optimized data store.
 *
 * @param query - plaintext search term
 * @param roomId - restrict search to this room
 * @param role - user's role for access check
 * @param limit - max results
 */
export async function searchMessages(
  query: string,
  roomId: string,
  role: UserRole,
  limit = 20
): Promise<MessageDto[]> {
  const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
  if (!room) {
    throw Object.assign(new Error(CHAT_ERRORS.ROOM_NOT_FOUND), { statusCode: 404 });
  }

  if (!room.allowedRoles.includes(role)) {
    throw Object.assign(new Error(CHAT_ERRORS.ACCESS_DENIED), { statusCode: 403 });
  }

  // fetch messages and decrypt in-memory for search
  const messages = await Message.find({ roomId, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate('senderId', 'username')
    .lean();

  const lowerQuery = query.toLowerCase();
  const results: MessageDto[] = [];

  for (const msg of messages) {
    try {
      const content = safeDecryptMessage(msg.encryptedContent);
      if (content.toLowerCase().includes(lowerQuery)) {
        const sender = msg.senderId as unknown as { _id: mongoose.Types.ObjectId; username: string };
        results.push({
          id: msg._id.toString(),
          roomId: msg.roomId.toString(),
          senderId: sender._id.toString(),
          senderUsername: sender.username,
          content,
          isDeleted: false,
          createdAt: msg.createdAt,
          editedAt: msg.editedAt,
        });
        if (results.length >= Math.min(limit, 100)) break;
      }
    } catch {
      continue;
    }
  }

  return results;
}
