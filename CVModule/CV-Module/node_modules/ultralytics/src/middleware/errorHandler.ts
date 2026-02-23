/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { UltralyticsError, ErrorCodes } from '../errors';

interface SyntaxErrorWithBody extends SyntaxError {
  status?: number;
  body?: unknown;
}

/**
 * Error handling middleware
 * Catches all errors and formats them consistently
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  console.error('Error:', {
    message: err.message,
    code: (err as UltralyticsError).code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Handle known Ultralytics errors
  if (err instanceof UltralyticsError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Handle JSON parsing errors
  const syntaxError = err as SyntaxErrorWithBody;
  if (err instanceof SyntaxError && syntaxError.status === 400 && 'body' in syntaxError) {
    res.status(400).json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid JSON in request body'
    });
    return;
  }


  // Handle unknown errors
  const statusCode = (err as { statusCode?: number; status?: number }).statusCode
    || (err as { status?: number }).status
    || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    error: ErrorCodes.INTERNAL_ERROR,
    message: message
  });
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: ErrorCodes.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`
  });
}
