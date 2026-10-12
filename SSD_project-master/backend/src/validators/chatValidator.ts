/**
 * chatValidator.ts
 *
 * express-validator chains for chat endpoints.
 * validates message content length, room parameters, and IDs.
 */

import { body, param, query } from 'express-validator';
import { MAX_MESSAGE_LENGTH, MIN_MESSAGE_LENGTH } from '../utils/constants';
import { ROOM_ACCESS_LEVELS } from '../models/ChatRoom';
import { PAGINATION } from '../config/constants';

/**
 * validation for sending a message.
 * content must be non-empty and within the character limit.
 */
export const sendMessageValidations = [
  param('roomId')
    .isMongoId().withMessage('Invalid room ID format'),

  body('content')
    .notEmpty().withMessage('Message content cannot be empty')
    .isString().withMessage('Message content must be a string')
    .isLength({ min: MIN_MESSAGE_LENGTH, max: MAX_MESSAGE_LENGTH })
    .withMessage(`Message must be between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters`)
    .trim(),
];

/**
 * validation for creating a chat room.
 * name is required; description and accessLevel are optional.
 */
export const createRoomValidations = [
  body('name')
    .trim()
    .notEmpty().withMessage('Room name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Room name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9 _\-]+$/)
    .withMessage('Room name may only contain letters, numbers, spaces, hyphens, and underscores'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

  body('accessLevel')
    .optional()
    .trim()
    .isIn(ROOM_ACCESS_LEVELS)
    .withMessage(`Access level must be one of: ${ROOM_ACCESS_LEVELS.join(', ')}`),
];

/**
 * validation for paginated message retrieval.
 */
export const getMessagesValidations = [
  param('roomId')
    .isMongoId().withMessage('Invalid room ID format'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION.MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION.MAX_LIMIT}`)
    .toInt(),
];

/**
 * validation for message deletion.
 */
export const deleteMessageValidations = [
  param('messageId')
    .isMongoId().withMessage('Invalid message ID format'),
];
