/**
 * chatController.ts
 *
 * HTTP request handlers for chat room and message endpoints.
 * delegates all business logic to chatService.
 * errors are forwarded to next(error) for the global error handler.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getRooms,
  createRoom,
  getRoomMessages,
  sendMessage,
  deleteMessage,
  searchMessages,
} from '../services/chatService';
import { HTTP_STATUS, PAGINATION } from '../config/constants';

/**
 * GET /api/chat/rooms
 * returns all chat rooms accessible to the authenticated user's role.
 */
export async function getRoomsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const role = req.user!.role;
    const rooms = await getRooms(role);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { rooms },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/chat/rooms
 * creates a new chat room. restricted to manager and admin roles.
 * expects { name, description?, accessLevel? } in the request body.
 */
export async function createRoomHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description, accessLevel } = req.body as {
      name: string;
      description?: string;
      accessLevel?: string;
    };
    const creatorId = req.user!.userId;

    const room = await createRoom(
      { name, description, accessLevel: accessLevel as import('../models/ChatRoom').RoomAccessLevel | undefined },
      creatorId,
      req
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Chat room created successfully.',
      data: { room },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/rooms/:roomId/messages
 * returns paginated messages for a specific room.
 * query params: page (default 1), limit (default 20).
 */
export async function getMessagesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params as { roomId: string };
    const role = req.user!.role;

    const page = parseInt((req.query['page'] as string) ?? '1', 10) || PAGINATION.DEFAULT_PAGE;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || PAGINATION.DEFAULT_LIMIT;

    const result = await getRoomMessages(roomId, role, page, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/chat/rooms/:roomId/messages
 * sends a message to a specific room.
 * expects { content } in the request body.
 */
export async function sendMessageHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params as { roomId: string };
    const { content } = req.body as { content: string };
    const { userId, role, username } = req.user!;

    const message = await sendMessage(roomId, userId, role, username, content, req);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Message sent successfully.',
      data: { message },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/chat/messages/:messageId
 * soft-deletes a message.
 * admins and managers can delete any message; employees can only delete their own.
 */
export async function deleteMessageHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { messageId } = req.params as { messageId: string };
    const { userId, role } = req.user!;

    await deleteMessage(messageId, userId, role, req);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/chat/rooms/:roomId/search?q=<query>
 * searches messages in a room by keyword.
 * decrypts messages in-memory and filters by the search term.
 * query params: q (required), limit (optional, default 20)
 */
export async function searchMessagesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params as { roomId: string };
    const role = req.user!.role;
    const query = (req.query['q'] as string | undefined) ?? '';
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10) || 20;

    if (!query || query.trim().length < 1) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Search query cannot be empty.',
      });
      return;
    }

    const messages = await searchMessages(query.trim(), roomId, role, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { messages, count: messages.length },
    });
  } catch (error) {
    next(error);
  }
}
