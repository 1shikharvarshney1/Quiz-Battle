import { ZodError } from 'zod';

/**
 * Central Express error-handling middleware.
 * Formats errors into a consistent { message } JSON structure
 * with appropriate HTTP status codes.
 */
export function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Zod validation error
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0]?.message || 'Validation failed';
    return res.status(400).json({ message: firstIssue });
  }

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ message: `A user with that ${field} already exists` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const firstMessage = Object.values(err.errors)[0]?.message || 'Validation error';
    return res.status(400).json({ message: firstMessage });
  }

  // Custom status code attached to error (e.g., from AI services or rate limits)
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  return res.status(statusCode).json({ message });
}
