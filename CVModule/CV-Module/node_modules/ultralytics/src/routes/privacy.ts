/**
 * Privacy routes for user data management
 * Implements GDPR-compliant data access, export, and deletion
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  anonymizeUserEvents, 
  deleteUserEvents, 
  getUserDataSummary,
  exportUserData 
} from '../services/anonymize';
import { NotFoundError, ValidationError } from '../errors';

const router = Router();

/**
 * GET /api/privacy/users/:userId/summary
 * Get a summary of data collected for a user
 */
router.get('/users/:userId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const summary = await getUserDataSummary(userId);

    if (summary.eventCount === 0) {
      throw new NotFoundError(`No data found for user: ${userId}`);
    }

    res.json({
      userId,
      summary
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/privacy/users/:userId/export
 * Export all data for a user (data portability)
 */
router.get('/users/:userId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const format = req.query.format || 'json';

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const data = await exportUserData(userId);

    if (data.events.length === 0) {
      throw new NotFoundError(`No data found for user: ${userId}`);
    }

    if (format === 'json') {
      res.json(data);
    } else {
      res.status(400).json({
        error: 'Invalid format',
        message: 'Only JSON format is currently supported'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/privacy/users/:userId/anonymize
 * Anonymize all data for a user (pseudonymization)
 */
router.post('/users/:userId/anonymize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const count = await anonymizeUserEvents(userId);

    if (count === 0) {
      throw new NotFoundError(`No data found for user: ${userId}`);
    }

    res.json({
      success: true,
      message: `Anonymized ${count} events for user`,
      userId,
      eventsAnonymized: count
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/privacy/users/:userId/data
 * Delete all data for a user (right to erasure)
 */
router.delete('/users/:userId/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const count = await deleteUserEvents(userId);

    if (count === 0) {
      throw new NotFoundError(`No data found for user: ${userId}`);
    }

    res.json({
      success: true,
      message: `Deleted ${count} events for user`,
      userId,
      eventsDeleted: count
    });
  } catch (error) {
    next(error);
  }
});

export default router;
