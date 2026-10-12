/**
 * validationMiddleware.ts
 *
 * express-validator integration middleware.
 * runs a set of validation chains and returns a structured 400 error
 * if any validation fails. field-level error details are returned to help
 * clients display meaningful form feedback.
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { HTTP_STATUS } from '../config/constants';
import { VALIDATION_ERRORS } from '../utils/errorMessages';
import { logger } from '../utils/logger';

/**
 * validates request data using the provided express-validator chains.
 * must be used after the validation chain definitions in route handlers.
 *
 * usage:
 *   router.post('/register', registerValidations, validate, handler)
 *
 * or as a composed middleware array:
 *   router.post('/register', [...registerValidations, validate], handler)
 *
 * @param validations - array of express-validator ValidationChain instances
 * @returns middleware that runs validations and returns errors
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // run all validation chains in parallel for performance
    await Promise.all(validations.map((v) => v.run(req)));

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      logger.debug('[validationMiddleware] request validation failed', {
        path: req.path,
        errorCount: errors.array().length,
      });

      // return structured field errors to the client
      // these ARE specific (field-level) because they help with form UX
      // but they don't expose internal system details
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: VALIDATION_ERRORS.INVALID_INPUT,
        errors: errors.array().map((err) => ({
          field: err.type === 'field' ? err.path : 'general',
          message: err.msg,
        })),
      });
      return;
    }

    next();
  };
}

/**
 * convenience middleware that checks validation results without running new chains.
 * use this AFTER inline validation chains in a route definition.
 * example:
 *   router.post('/', body('name').notEmpty(), checkValidation, handler)
 */
export function checkValidation(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: VALIDATION_ERRORS.INVALID_INPUT,
      errors: errors.array().map((err) => ({
        field: err.type === 'field' ? err.path : 'general',
        message: err.msg,
      })),
    });
    return;
  }

  next();
}
