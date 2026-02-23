/**
 * Event property validation using JSON Schema
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import sanitizeHtml from 'sanitize-html';

const ajv = new Ajv({ allErrors: true });

// Schema for event properties
const eventPropertiesSchema = {
  type: 'object',
  additionalProperties: {
    anyOf: [
      { type: 'string', maxLength: 1000 },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'null' },
      {
        type: 'array',
        items: {
          anyOf: [
            { type: 'string', maxLength: 1000 },
            { type: 'number' },
            { type: 'boolean' }
          ]
        },
        maxItems: 100
      }
    ]
  },
  maxProperties: 50
};

// Schema for a single event
export const eventSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^[a-zA-Z0-9_.-]+$'
    },
    properties: eventPropertiesSchema,
    sessionId: {
      type: ['string', 'null'],
      maxLength: 255
    },
    userId: {
      type: ['string', 'null'],
      maxLength: 255
    },
    timestamp: {
      type: ['string', 'null'],
      format: 'date-time'
    }
  },
  additionalProperties: false
};


// Schema for batch events
export const batchEventSchema = {
  type: 'object',
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: eventSchema,
      minItems: 1,
      maxItems: 10000
    }
  },
  additionalProperties: false
};

// Compile validators
const validateEvent: ValidateFunction = ajv.compile(eventSchema);
const validateBatchEvents: ValidateFunction = ajv.compile(batchEventSchema);

export interface ValidationResult {
  valid: boolean;
  errors: string | null;
}

/**
 * Format AJV errors into readable messages
 */
function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors) return '';
  return errors.map(err => {
    const path = err.instancePath || 'root';
    return `${path}: ${err.message}`;
  }).join('; ');
}

/**
 * Sanitize HTML from string values to prevent XSS attacks
 */
function sanitizeString(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  });
}

/**
 * Recursively sanitize all string values in an object
 */
export function sanitizeEventProperties(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeEventProperties(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeEventProperties(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate a single event
 */
export function validateEventData(event: unknown): ValidationResult {
  const valid = validateEvent(event);
  return {
    valid,
    errors: valid ? null : formatErrors(validateEvent.errors)
  };
}

/**
 * Validate batch events
 */
export function validateBatchEventData(data: unknown): ValidationResult {
  const valid = validateBatchEvents(data);
  return {
    valid,
    errors: valid ? null : formatErrors(validateBatchEvents.errors)
  };
}
