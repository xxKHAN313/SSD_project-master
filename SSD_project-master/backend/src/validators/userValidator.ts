/**
 * userValidator.ts
 *
 * express-validator chains for user management endpoints.
 * all user management operations are admin-only and validated here.
 */

import { body, param } from 'express-validator';
import { VALID_ROLES, USERNAME_CONSTRAINTS, PASSWORD_POLICY } from '../config/constants';

/**
 * validation rules for creating a new user (admin endpoint).
 * includes role field that regular registration does not expose.
 */
export const createUserValidations = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: USERNAME_CONSTRAINTS.MIN_LENGTH, max: USERNAME_CONSTRAINTS.MAX_LENGTH })
    .withMessage(`Username must be between ${USERNAME_CONSTRAINTS.MIN_LENGTH} and ${USERNAME_CONSTRAINTS.MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: PASSWORD_POLICY.MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`)
    .isLength({ max: PASSWORD_POLICY.MAX_LENGTH })
    .withMessage(`Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`)
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),

  body('role')
    .trim()
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
];

/**
 * validation rules for updating an existing user.
 * only allows changing username and email (not role — use /role endpoint).
 * all fields are optional (partial update).
 */
export const updateUserValidations = [
  param('id')
    .isMongoId().withMessage('Invalid user ID format'),

  body('username')
    .optional()
    .trim()
    .isLength({ min: USERNAME_CONSTRAINTS.MIN_LENGTH, max: USERNAME_CONSTRAINTS.MAX_LENGTH })
    .withMessage(`Username must be between ${USERNAME_CONSTRAINTS.MIN_LENGTH} and ${USERNAME_CONSTRAINTS.MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_dots: false }),
];

/**
 * validation rules for role assignment.
 */
export const assignRoleValidations = [
  param('id')
    .isMongoId().withMessage('Invalid user ID format'),

  body('role')
    .trim()
    .notEmpty().withMessage('Role is required')
    .isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
];

/**
 * validation rule for ID parameter (used in single-user endpoints).
 */
export const userIdParamValidation = [
  param('id')
    .isMongoId().withMessage('Invalid user ID format'),
];
