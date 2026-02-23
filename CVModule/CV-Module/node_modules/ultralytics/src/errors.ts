/**
 * Custom error classes for Ultralytics
 * Enhanced with detailed context for debugging
 */

// Error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ErrorContext {
  operation?: string;
  timestamp?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
}

export interface ErrorJSON {
  error: ErrorCode;
  message: string;
  field?: string;
  context?: ErrorContext;
  hint?: string;
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Base error class for Ultralytics
 * Includes enhanced context for debugging
 */
export class UltralyticsError extends Error {
  public code: ErrorCode;
  public statusCode: number;
  public context: ErrorContext;
  public hint?: string;

  constructor(
    message: string, 
    code: ErrorCode, 
    statusCode: number = 500,
    context: ErrorContext = {}
  ) {
    super(message);
    this.name = 'UltralyticsError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      ...context
    };
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Add additional context to the error
   */
  withContext(additionalContext: Partial<ErrorContext>): this {
    this.context = { ...this.context, ...additionalContext };
    return this;
  }

  /**
   * Add a hint for resolving the error
   */
  withHint(hint: string): this {
    this.hint = hint;
    return this;
  }

  /**
   * Get a formatted error message with context
   */
  getDetailedMessage(): string {
    const parts = [this.message];
    
    if (this.context.operation) {
      parts.push(`Operation: ${this.context.operation}`);
    }
    if (this.context.requestId) {
      parts.push(`Request ID: ${this.context.requestId}`);
    }
    if (this.hint) {
      parts.push(`Hint: ${this.hint}`);
    }
    
    return parts.join(' | ');
  }

  toJSON(): ErrorJSON {
    const json: ErrorJSON = {
      error: this.code,
      message: this.message
    };
    
    // Include context in development/debug mode
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      json.context = this.context;
    }
    
    if (this.hint) {
      json.hint = this.hint;
    }
    
    return json;
  }
}


/**
 * Validation error (400)
 * Thrown when input data fails validation
 */
export class ValidationError extends UltralyticsError {
  public field: string | null;
  public receivedValue?: unknown;

  constructor(
    message: string, 
    field: string | null = null,
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400, {
      operation: 'validation',
      ...context
    });
    this.name = 'ValidationError';
    this.field = field;
  }

  /**
   * Attach the received value for debugging
   */
  withReceivedValue(value: unknown): this {
    this.receivedValue = value;
    if (this.context.details) {
      this.context.details.receivedValue = value;
    } else {
      this.context.details = { receivedValue: value };
    }
    return this;
  }

  toJSON(): ErrorJSON {
    const json = super.toJSON();
    if (this.field) {
      json.field = this.field;
    }
    return json;
  }
}

/**
 * Not found error (404)
 * Thrown when a requested resource doesn't exist
 */
export class NotFoundError extends UltralyticsError {
  public resourceType?: string;
  public resourceId?: string;

  constructor(
    message: string = 'Resource not found',
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.NOT_FOUND, 404, context);
    this.name = 'NotFoundError';
  }

  /**
   * Specify which resource was not found
   */
  forResource(type: string, id: string): this {
    this.resourceType = type;
    this.resourceId = id;
    this.context.details = {
      ...this.context.details,
      resourceType: type,
      resourceId: id
    };
    return this.withHint(`Check that the ${type} with ID "${id}" exists`);
  }
}

/**
 * Unauthorized error (401)
 * Thrown when authentication fails
 */
export class UnauthorizedError extends UltralyticsError {
  constructor(
    message: string = 'Unauthorized',
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.UNAUTHORIZED, 401, {
      operation: 'authentication',
      ...context
    });
    this.name = 'UnauthorizedError';
    this.hint = 'Check that your API key is valid and included in the request headers';
  }
}

/**
 * Rate limited error (429)
 * Thrown when request rate limit is exceeded
 */
export class RateLimitedError extends UltralyticsError {
  public retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.RATE_LIMITED, 429, context);
    this.name = 'RateLimitedError';
    this.retryAfter = retryAfter;
    
    if (retryAfter) {
      this.hint = `Retry after ${retryAfter} seconds`;
      this.context.details = {
        ...this.context.details,
        retryAfter
      };
    }
  }
}

/**
 * Database error (500)
 * Thrown when a database operation fails
 */
export class DatabaseError extends UltralyticsError {
  public query?: string;
  public originalError?: Error;

  constructor(
    message: string = 'Database error occurred',
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.DATABASE_ERROR, 500, {
      operation: 'database',
      ...context
    });
    this.name = 'DatabaseError';
  }

  /**
   * Attach original database error for debugging
   */
  causedBy(error: Error): this {
    this.originalError = error;
    // Don't expose internal error details in production
    if (process.env.NODE_ENV !== 'production') {
      this.context.details = {
        ...this.context.details,
        originalMessage: error.message
      };
    }
    return this;
  }

  /**
   * Attach the query that failed (sanitized)
   */
  forQuery(query: string): this {
    // Only include query in non-production
    if (process.env.NODE_ENV !== 'production') {
      this.query = query;
      this.context.details = {
        ...this.context.details,
        query
      };
    }
    return this;
  }
}

/**
 * Connection error (503)
 * Thrown when a service connection fails
 */
export class ConnectionError extends UltralyticsError {
  public service?: string;

  constructor(
    message: string = 'Connection failed',
    service?: string,
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.CONNECTION_ERROR, 503, context);
    this.name = 'ConnectionError';
    this.service = service;
    
    if (service) {
      this.context.details = {
        ...this.context.details,
        service
      };
      this.hint = `Check that the ${service} service is running and accessible`;
    }
  }
}

/**
 * Timeout error (504)
 * Thrown when an operation times out
 */
export class TimeoutError extends UltralyticsError {
  public timeoutMs?: number;

  constructor(
    message: string = 'Operation timed out',
    timeoutMs?: number,
    context: ErrorContext = {}
  ) {
    super(message, ErrorCodes.TIMEOUT_ERROR, 504, context);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    
    if (timeoutMs) {
      this.context.details = {
        ...this.context.details,
        timeoutMs
      };
      this.hint = `Operation exceeded ${timeoutMs}ms timeout`;
    }
  }
}

/**
 * Helper to wrap unknown errors
 */
export function wrapError(error: unknown, context: ErrorContext = {}): UltralyticsError {
  if (error instanceof UltralyticsError) {
    return error.withContext(context);
  }
  
  if (error instanceof Error) {
    const wrapped = new UltralyticsError(
      error.message,
      ErrorCodes.INTERNAL_ERROR,
      500,
      context
    );
    wrapped.stack = error.stack;
    return wrapped;
  }
  
  return new UltralyticsError(
    String(error),
    ErrorCodes.INTERNAL_ERROR,
    500,
    context
  );
}
