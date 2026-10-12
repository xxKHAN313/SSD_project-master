/**
 * chatRoutes.ts
 *
 * route definitions for /api/chat/* endpoints.
 * all routes require authentication via verifyToken.
 * room creation is restricted to manager and admin roles.
 * rate limiting is applied per endpoint category.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { messageRateLimiter, readRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';
import {
  sendMessageValidations,
  createRoomValidations,
  getMessagesValidations,
  deleteMessageValidations,
} from '../validators/chatValidator';
import {
  getRoomsHandler,
  createRoomHandler,
  getMessagesHandler,
  sendMessageHandler,
  deleteMessageHandler,
  searchMessagesHandler,
} from '../controllers/chatController';

const router = Router();

/**
 * GET /api/chat/rooms
 * returns all chat rooms accessible to the authenticated user's role.
 * read rate limit applied.
 */
router.get('/rooms', verifyToken, readRateLimiter, getRoomsHandler);

/**
 * POST /api/chat/rooms
 * creates a new chat room.
 * restricted to managers and admins.
 * expects { name, description?, accessLevel? } in the body.
 */
router.post(
  '/rooms',
  verifyToken,
  requireRole('manager', 'admin'),
  apiRateLimiter,
  validate(createRoomValidations),
  createRoomHandler
);

/**
 * GET /api/chat/rooms/:roomId/messages
 * returns paginated messages for a specific room.
 * user must have access to the room (enforced by chatService).
 */
router.get(
  '/rooms/:roomId/messages',
  verifyToken,
  readRateLimiter,
  validate(getMessagesValidations),
  getMessagesHandler
);

/**
 * GET /api/chat/rooms/:roomId/search
 * searches messages in a room by keyword.
 * query param: q (search term)
 */
router.get(
  '/rooms/:roomId/search',
  verifyToken,
  readRateLimiter,
  searchMessagesHandler
);

/**
 * POST /api/chat/rooms/:roomId/messages
 * sends a new message to a specific room.
 * message rate limit applied to prevent spam flooding.
 * expects { content } in the body.
 */
router.post(
  '/rooms/:roomId/messages',
  verifyToken,
  messageRateLimiter,
  validate(sendMessageValidations),
  sendMessageHandler
);

/**
 * DELETE /api/chat/messages/:messageId
 * soft-deletes a message by its ID.
 * employees can only delete their own messages.
 * managers and admins can delete any message.
 */
router.delete(
  '/messages/:messageId',
  verifyToken,
  apiRateLimiter,
  validate(deleteMessageValidations),
  deleteMessageHandler
);

export default router;
