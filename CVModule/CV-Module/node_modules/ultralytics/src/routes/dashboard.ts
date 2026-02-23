import { Router, Request, Response, NextFunction } from 'express';
import * as db from '../db';

const router = Router();

/**
 * Check if materialized views exist and are recent enough
 */
async function canUseMaterializedView(viewName: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT EXISTS (
        SELECT FROM pg_matviews WHERE matviewname = $1
      )`,
      [viewName]
    );
    return result.rows[0].exists;
  } catch {
    return false;
  }
}

/**
 * Refresh materialized views (called periodically or on-demand)
 */
export async function refreshMaterializedViews(): Promise<void> {
  try {
    await db.query('SELECT refresh_dashboard_stats()');
  } catch (error) {
    console.warn('Failed to refresh materialized views:', error);
  }
}

/**
 * GET /api/dashboard/summary
 * Returns a summary of analytics data for the dashboard
 * Optimized to use materialized views when available
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Try to use materialized view for better performance
    const useMaterializedView = await canUseMaterializedView('daily_event_stats');
    
    let eventsResult, sessionsResult, usersResult, pageviewsResult, topEventsResult;

    if (useMaterializedView) {
      // Optimized queries using materialized views
      const summaryResult = await db.query(
        `SELECT 
          SUM(event_count) as total_events,
          SUM(unique_sessions) as unique_sessions,
          SUM(unique_users) as unique_users
        FROM daily_event_stats 
        WHERE day >= $1 AND day <= $2`,
        [start, end]
      );
      
      eventsResult = { rows: [{ total_events: summaryResult.rows[0]?.total_events || 0 }] };
      sessionsResult = { rows: [{ unique_sessions: summaryResult.rows[0]?.unique_sessions || 0 }] };
      usersResult = { rows: [{ unique_users: summaryResult.rows[0]?.unique_users || 0 }] };

      pageviewsResult = await db.query(
        `SELECT SUM(event_count) as pageviews 
         FROM daily_event_stats 
         WHERE day >= $1 AND day <= $2 
         AND event_name = 'pageview'`,
        [start, end]
      );

      topEventsResult = await db.query(
        `SELECT event_name as name, SUM(event_count) as count 
         FROM daily_event_stats 
         WHERE day >= $1 AND day <= $2 
         GROUP BY event_name 
         ORDER BY count DESC 
         LIMIT 10`,
        [start, end]
      );
    } else {
      // Fallback to original queries
      eventsResult = await db.query(
        `SELECT COUNT(*) as total_events 
         FROM events 
         WHERE timestamp >= $1 AND timestamp <= $2`,
        [start, end]
      );

      sessionsResult = await db.query(
        `SELECT COUNT(DISTINCT session_id) as unique_sessions 
         FROM events 
         WHERE timestamp >= $1 AND timestamp <= $2 
         AND session_id IS NOT NULL`,
        [start, end]
      );

      usersResult = await db.query(
        `SELECT COUNT(DISTINCT user_id) as unique_users 
         FROM events 
         WHERE timestamp >= $1 AND timestamp <= $2 
         AND user_id IS NOT NULL`,
        [start, end]
      );

      pageviewsResult = await db.query(
        `SELECT COUNT(*) as pageviews 
         FROM events 
         WHERE timestamp >= $1 AND timestamp <= $2 
         AND name = 'pageview'`,
        [start, end]
      );

      topEventsResult = await db.query(
        `SELECT name, COUNT(*) as count 
         FROM events 
         WHERE timestamp >= $1 AND timestamp <= $2 
         GROUP BY name 
         ORDER BY count DESC 
         LIMIT 10`,
        [start, end]
      );
    }

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        totalEvents: parseInt(eventsResult.rows[0]?.total_events || '0', 10),
        uniqueSessions: parseInt(sessionsResult.rows[0]?.unique_sessions || '0', 10),
        uniqueUsers: parseInt(usersResult.rows[0]?.unique_users || '0', 10),
        pageviews: parseInt(pageviewsResult.rows[0]?.pageviews || '0', 10)
      },
      topEvents: topEventsResult.rows,
      optimized: useMaterializedView
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/events-over-time
 * Returns event counts grouped by time intervals
 * Optimized to use materialized views when available
 */
router.get('/events-over-time', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Check if we can use materialized views
    const useDailyView = interval === 'day' && await canUseMaterializedView('daily_event_stats');
    const useHourlyView = interval === 'hour' && await canUseMaterializedView('hourly_event_stats');

    let result;

    if (useDailyView) {
      // Use daily materialized view
      result = await db.query(
        `SELECT 
          day as period,
          SUM(event_count) as event_count,
          SUM(unique_sessions) as session_count
         FROM daily_event_stats 
         WHERE day >= $1 AND day <= $2
         GROUP BY day
         ORDER BY day ASC`,
        [start, end]
      );
    } else if (useHourlyView) {
      // Use hourly materialized view
      result = await db.query(
        `SELECT 
          hour as period,
          SUM(event_count) as event_count,
          SUM(unique_sessions) as session_count
         FROM hourly_event_stats 
         WHERE hour >= $1 AND hour <= $2
         GROUP BY hour
         ORDER BY hour ASC`,
        [start, end]
      );
    } else {
      // Fallback to original query
      let dateTrunc: string;
      switch (interval) {
        case 'hour':
          dateTrunc = 'hour';
          break;
        case 'week':
          dateTrunc = 'week';
          break;
        case 'month':
          dateTrunc = 'month';
          break;
        case 'day':
        default:
          dateTrunc = 'day';
      }

      result = await db.query(
        `SELECT 
          DATE_TRUNC($1, timestamp) as period,
          COUNT(*) as event_count,
          COUNT(DISTINCT session_id) as session_count
         FROM events 
         WHERE timestamp >= $2 AND timestamp <= $3
         GROUP BY DATE_TRUNC($1, timestamp)
         ORDER BY period ASC`,
        [dateTrunc, start, end]
      );
    }

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      interval: interval,
      data: result.rows.map(row => ({
        period: row.period,
        eventCount: parseInt(row.event_count, 10),
        sessionCount: parseInt(row.session_count, 10)
      })),
      optimized: useDailyView || useHourlyView
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/dashboard/refresh
 * Manually trigger refresh of materialized views
 */
router.post('/refresh', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await refreshMaterializedViews();
    res.json({ success: true, message: 'Materialized views refreshed' });
  } catch (error) {
    next(error);
  }
});

export default router;
