import { Router, Request, Response, NextFunction } from 'express';
import { analyzeFunnel, FunnelQuery } from '../services/funnel';
import { analyzeCohort, CohortQuery } from '../services/cohort';

const router = Router();

/**
 * POST /api/analytics/funnel
 * Analyze conversion through a funnel of events
 */
router.post('/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { steps, startDate, endDate, groupBy } = req.body;
    
    // Validate required fields
    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'steps must be an array of event steps'
      });
    }
    
    if (steps.length < 2) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Funnel must have at least 2 steps'
      });
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required'
      });
    }
    
    // Validate each step has an eventName
    for (const step of steps) {
      if (!step.eventName || typeof step.eventName !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Each step must have an eventName'
        });
      }
    }
    
    const query: FunnelQuery = {
      steps,
      startDate,
      endDate,
      groupBy
    };
    
    const result = await analyzeFunnel(query);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analytics/cohort
 * Analyze user retention by cohort
 */
router.post('/cohort', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortEvent, returnEvent, startDate, endDate, granularity, periods } = req.body;
    
    // Validate required fields
    if (!cohortEvent || typeof cohortEvent !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'cohortEvent is required and must be a string'
      });
    }
    
    if (!returnEvent || typeof returnEvent !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'returnEvent is required and must be a string'
      });
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required'
      });
    }
    
    const validGranularities = ['day', 'week', 'month'];
    if (granularity && !validGranularities.includes(granularity)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'granularity must be one of: day, week, month'
      });
    }
    
    const periodsValue = periods ? parseInt(periods, 10) : 12;
    if (isNaN(periodsValue) || periodsValue < 1 || periodsValue > 52) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'periods must be a number between 1 and 52'
      });
    }
    
    const query: CohortQuery = {
      cohortEvent,
      returnEvent,
      startDate,
      endDate,
      granularity: granularity || 'week',
      periods: periodsValue
    };
    
    const result = await analyzeCohort(query);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
