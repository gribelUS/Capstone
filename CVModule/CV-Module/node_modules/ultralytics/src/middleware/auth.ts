import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import * as db from '../db';

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: number;
    name: string;
  };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  // If lengths differ, compare against a dummy buffer of same length
  // This ensures constant time regardless of length difference
  if (bufA.length !== bufB.length) {
    const dummy = Buffer.alloc(bufA.length);
    crypto.timingSafeEqual(bufA, dummy);
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate API key from request header
 * API key should be sent in the X-API-Key header
 */
export async function validateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      error: 'API key is required',
      message: 'Please provide an API key in the X-API-Key header'
    });
    return;
  }

  try {
    // Hash the provided key to compare with stored hash
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const result = await db.query(
      'SELECT id, name FROM api_keys WHERE key_hash = $1 AND is_active = TRUE',
      [keyHash]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked'
      });
      return;
    }

    // Update last used timestamp
    await db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [result.rows[0].id]
    );

    // Attach key info to request for potential use in handlers
    req.apiKey = {
      id: result.rows[0].id,
      name: result.rows[0].name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to validate API key'
    });
  }
}
