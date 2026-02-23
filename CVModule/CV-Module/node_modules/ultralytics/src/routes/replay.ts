/**
 * Event replay routes
 * APIs for replaying and analyzing event sequences
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getEventsForReplay,
  getSessionReplay,
  getUserJourneyReplay,
  getEventTimeline
} from '../services/replay';
import { ValidationError, NotFoundError } from '../errors';

const router = Router();

/**
 * GET /api/replay/events
 * Get events for replay within a time range
 */
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, userId, sessionId, eventTypes, limit } = req.query;

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    const events = await getEventsForReplay(start, end, {
      userId: userId as string | undefined,
      sessionId: sessionId as string | undefined,
      eventTypes: eventTypes ? (eventTypes as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      eventCount: events.length,
      totalDurationMs: events.length > 0 
        ? events[events.length - 1].relativeTimeMs 
        : 0,
      events
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/replay/sessions/:sessionId
 * Get a complete session replay
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required');
    }

    const session = await getSessionReplay(sessionId);

    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/replay/users/:userId/journey
 * Get user journey replay (all sessions)
 */
router.get('/users/:userId/journey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const journey = await getUserJourneyReplay(userId, {
      limit: limit ? parseInt(limit as string, 10) : undefined
    });

    if (journey.sessionCount === 0) {
      throw new NotFoundError(`No sessions found for user: ${userId}`);
    }

    res.json(journey);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/replay/timeline
 * Get event timeline grouped by time buckets
 */
router.get('/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, bucketSize } = req.query;

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    const bucketSizeMs = bucketSize 
      ? parseInt(bucketSize as string, 10) 
      : 60000; // Default 1 minute

    if (bucketSizeMs < 1000) {
      throw new ValidationError('Bucket size must be at least 1000ms');
    }

    const timeline = await getEventTimeline(start, end, bucketSizeMs);

    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucketSizeMs,
      bucketCount: timeline.length,
      timeline
    });
  } catch (error) {
    next(error);
  }
});

export default router;
