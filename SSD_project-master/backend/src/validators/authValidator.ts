/**
 * authValidator.ts
 *
 * express-validator chains for authentication endpoints.
 * validates and sanitizes all input before passing to service layer.
 * validation errors return field-level messages; service errors are generic.
 */

import { body } from 'express-validator';
import { PASSWORD_POLICY, USERNAME_CONSTRAINTS } from '../config/constants';

/**
 * validation rules for user registration.
 * username: 3-30 chars, alphanumeric + underscore only
 * email: valid RFC-format email, normalized to lowercase
 * password: minimum complexity requirements
 */
export const registerValidations = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: USERNAME_CONSTRAINTS.MIN_LENGTH, max: USERNAME_CONSTRAINTS.MAX_LENGTH })
    .withMessage(`Username must be between ${USERNAME_CONSTRAINTS.MIN_LENGTH} and ${USERNAME_CONSTRAINTS.MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores')
    .escape(), // prevent XSS in username

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_dots: false })
    .isLength({ max: 254 }).withMessage('Email address is too long'),

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
];

/**
 * validation rules for user login.
 * kept minimal — username and password only.
 * do not sanitize password (bcrypt comparison requires exact string).
 */
export const loginValidations = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 1, max: USERNAME_CONSTRAINTS.MAX_LENGTH })
    .withMessage('Username is too long'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 200 }).withMessage('Password is too long'),
];

/**
 * validation rules for forgot password request.
 * only accepts an email address.
 */
export const forgotPasswordValidations = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail({ gmail_remove_dots: false }),
];

/**
 * validation rules for self-service password change.
 * requires the current password plus a strong new password.
 */
export const changePasswordValidations = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required')
    .isLength({ max: 200 }).withMessage('Current password is too long'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: PASSWORD_POLICY.MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`)
    .isLength({ max: PASSWORD_POLICY.MAX_LENGTH })
    .withMessage(`Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`)
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),
];

/**
 * validation rules for password reset completion.
 * validates the new password complexity and token format.
 */
export const resetPasswordValidations = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required')
    .isHexadecimal().withMessage('Invalid reset token format')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token length'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: PASSWORD_POLICY.MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long`)
    .isLength({ max: PASSWORD_POLICY.MAX_LENGTH })
    .withMessage(`Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`)
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),
];
